#!/usr/bin/env node
/* eslint-disable no-console */
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function mustEnv(key) {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`Missing env var: ${key}`);
  }
  return value.trim();
}

function nowIso() {
  return new Date().toISOString();
}

function logOk(msg) {
  console.log(`OK   ${msg}`);
}

function logWarn(msg) {
  console.warn(`WARN ${msg}`);
}

function logErr(msg) {
  console.error(`ERR  ${msg}`);
}

async function run() {
  const startedAt = Date.now();
  const failures = [];
  const cleanup = {
    workspaceId: null,
    stripeEventId: null,
  };

  try {
    const supabaseUrl = mustEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecret = mustEnv('STRIPE_SECRET_KEY');
    const appUrl = mustEnv('NEXT_PUBLIC_APP_URL');
    const webhookSecret = mustEnv('STRIPE_WEBHOOK_SECRET');
    const prices = {
      starter: mustEnv('STRIPE_PRICE_STARTER'),
      growth: mustEnv('STRIPE_PRICE_GROWTH'),
      scale: mustEnv('STRIPE_PRICE_SCALE'),
    };

    const isLive = stripeSecret.startsWith('sk_live_');
    const hasHttpsAppUrl = appUrl.startsWith('https://');
    if (isLive && !hasHttpsAppUrl) {
      failures.push('NEXT_PUBLIC_APP_URL must be HTTPS when STRIPE_SECRET_KEY is live');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const stripe = new Stripe(stripeSecret, { apiVersion: '2026-01-28.clover' });

    console.log('\n=== Forensic Validation: Environment ===');
    logOk(`Mode: ${isLive ? 'LIVE' : 'TEST'}`);
    logOk(`APP URL: ${appUrl}`);
    logOk(`Webhook secret present: ${webhookSecret.slice(0, 6)}...`);

    console.log('\n=== Forensic Validation: Stripe Prices ===');
    for (const [plan, priceId] of Object.entries(prices)) {
      try {
        const price = await stripe.prices.retrieve(priceId);
        if (!price || price.deleted) {
          failures.push(`Price ${priceId} for ${plan} does not exist`);
          continue;
        }
        if (!price.recurring) {
          failures.push(`Price ${priceId} for ${plan} is not recurring`);
          continue;
        }
        logOk(`${plan}: ${price.id} (${price.currency} ${price.unit_amount}/${price.recurring.interval})`);
      } catch (err) {
        failures.push(`Cannot retrieve Stripe price for ${plan}: ${err.message}`);
      }
    }

    console.log('\n=== Forensic Validation: Stripe Checkout Sessions (real) ===');
    for (const [plan, priceId] of Object.entries(prices)) {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{ price: priceId, quantity: 1 }],
          client_reference_id: `forensic_${plan}_${Date.now()}`,
          metadata: { workspaceId: `forensic_${plan}`, workspaceName: 'Forensic Check', plan },
          subscription_data: {
            trial_period_days: 7,
            metadata: { workspaceId: `forensic_${plan}`, plan },
          },
          success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/onboarding?workspaceId=forensic_${plan}`,
        });

        if (!session.url) {
          failures.push(`Stripe checkout session created without URL for ${plan}`);
        } else {
          logOk(`${plan}: checkout session created (${session.id})`);
        }
      } catch (err) {
        failures.push(`Stripe checkout session failed for ${plan}: ${err.message}`);
      }
    }

    console.log('\n=== Forensic Validation: Supabase Schema + Critical Upserts ===');
    try {
      const { error: pingError } = await supabase.from('workspaces').select('id').limit(1);
      if (pingError) throw pingError;
      logOk('Supabase connection to workspaces table');

      const workspaceTag = crypto.randomUUID().slice(0, 8);
      const tempWorkspace = {
        slack_workspace_id: `forensic_${workspaceTag}`,
        team_name: 'Forensic Workspace',
        access_token: 'forensic_dummy_encrypted_token',
        refresh_token: null,
        token_expires_at: null,
        installed_by: 'U_FORENSIC',
        plan_type: 'starter',
        supports_user_deactivation: false,
        estimated_seat_cost: 15,
        is_active: true,
        alert_recipients: ['U_FORENSIC'],
      };

      const { data: insertedWs, error: wsInsertError } = await supabase
        .from('workspaces')
        .insert(tempWorkspace)
        .select('id')
        .single();

      if (wsInsertError || !insertedWs) {
        throw new Error(`Workspace insert failed: ${wsInsertError?.message ?? 'unknown'}`);
      }

      cleanup.workspaceId = insertedWs.id;
      logOk(`Workspace insert OK (${cleanup.workspaceId})`);

      const subPayload = {
        workspace_id: cleanup.workspaceId,
        stripe_customer_id: `cus_forensic_${workspaceTag}`,
        stripe_subscription_id: `sub_forensic_${workspaceTag}`,
        plan: 'starter',
        status: 'trialing',
      };

      const { error: subUpsert1 } = await supabase
        .from('subscriptions')
        .upsert(subPayload, { onConflict: 'workspace_id' });
      if (subUpsert1) throw new Error(`subscriptions upsert #1 failed: ${subUpsert1.message}`);

      const { error: subUpsert2 } = await supabase
        .from('subscriptions')
        .upsert({ ...subPayload, plan: 'growth', status: 'active' }, { onConflict: 'workspace_id' });
      if (subUpsert2) throw new Error(`subscriptions upsert #2 failed: ${subUpsert2.message}`);
      logOk('subscriptions upsert on workspace_id works');

      const auditPayload = {
        workspace_id: cleanup.workspaceId,
        slack_user_id: `U_GUEST_${workspaceTag}`,
        last_seen_source: 'forensic_check',
        estimated_cost_monthly: 15,
        estimated_cost_yearly: 180,
        is_flagged: true,
        action_taken: 'flagged',
      };

      const { error: gaUpsert1 } = await supabase
        .from('guest_audits')
        .upsert(auditPayload, { onConflict: 'workspace_id,slack_user_id' });
      if (gaUpsert1) throw new Error(`guest_audits upsert #1 failed: ${gaUpsert1.message}`);

      const { error: gaUpsert2 } = await supabase
        .from('guest_audits')
        .upsert({ ...auditPayload, estimated_cost_monthly: 0, estimated_cost_yearly: 0 }, { onConflict: 'workspace_id,slack_user_id' });
      if (gaUpsert2) throw new Error(`guest_audits upsert #2 failed: ${gaUpsert2.message}`);
      logOk('guest_audits upsert on (workspace_id, slack_user_id) works');

      cleanup.stripeEventId = `evt_forensic_${workspaceTag}`;
      const { error: seInsert } = await supabase.from('stripe_events_history').insert({
        stripe_event_id: cleanup.stripeEventId,
        status: 'processing',
        attempts: 1,
        updated_at: nowIso(),
      });
      if (seInsert) throw new Error(`stripe_events_history insert failed: ${seInsert.message}`);

      const { error: seUpdate } = await supabase
        .from('stripe_events_history')
        .update({
          status: 'processed',
          last_error: null,
          processed_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq('stripe_event_id', cleanup.stripeEventId);
      if (seUpdate) throw new Error(`stripe_events_history update failed: ${seUpdate.message}`);
      logOk('stripe_events_history status lifecycle works');
    } catch (err) {
      const detail = err && typeof err === 'object'
        ? (err.details || err.cause?.message || err.message || JSON.stringify(err))
        : String(err);
      failures.push(`Supabase critical check failed: ${detail}`);
    } finally {
      if (cleanup.stripeEventId) {
        await supabase.from('stripe_events_history').delete().eq('stripe_event_id', cleanup.stripeEventId);
      }

      if (cleanup.workspaceId) {
        await supabase.from('guest_audits').delete().eq('workspace_id', cleanup.workspaceId);
        await supabase.from('subscriptions').delete().eq('workspace_id', cleanup.workspaceId);
        await supabase.from('workspaces').delete().eq('id', cleanup.workspaceId);
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log('\n=== Forensic Validation: Result ===');
    if (failures.length === 0) {
      logOk(`All critical validations passed in ${durationMs}ms`);
      process.exit(0);
    }

    logErr(`Detected ${failures.length} issue(s) in ${durationMs}ms:`);
    failures.forEach((f, i) => {
      logErr(`${i + 1}. ${f}`);
    });
    process.exit(1);
  } catch (err) {
    logErr(`Fatal forensic validation error: ${err.message}`);
    process.exit(1);
  }
}

run();
