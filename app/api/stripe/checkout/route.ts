import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const workspaceId = formData.get('workspaceId');

        if (!workspaceId) {
            return NextResponse.redirect(new URL('/?error=missing_workspace', request.url));
        }

        // Verify workspace exists
        const { data: workspace } = await supabase
            .from('workspaces')
            .select('id, team_name, slack_workspace_id')
            .eq('id', workspaceId)
            .single();

        if (!workspace) {
            return NextResponse.redirect(new URL('/?error=invalid_workspace', request.url));
        }

        // Create Checkout Session
        // MVP uses a placeholder or env variable for Price ID
        const priceId = process.env.STRIPE_PRICE_ID;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId || 'price_placeholder', // Ensure you create a recurrring price in Stripe Dashboard
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            subscription_data: {
                trial_period_days: 7, // 7 days free trial
                metadata: {
                    workspaceId: workspace.id
                }
            },
            client_reference_id: workspace.id,
            success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding?workspaceId=${workspace.id}`,
        });

        if (session.url) {
            return NextResponse.redirect(session.url, 303);
        }

        return NextResponse.redirect(new URL('/?error=stripe_error', request.url));
    } catch (error) {
        console.error("Stripe Checkout Error:", error);
        return NextResponse.redirect(new URL('/?error=internal_error', request.url));
    }
}
