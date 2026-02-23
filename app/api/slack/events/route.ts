export const dynamic = 'force-dynamic';
import { NextResponse, after } from 'next/server';
import { verifySlackSignature } from '@/lib/slack';
import { slackEventService } from '@/services/slack-event.service';
import { logger } from '@/lib/logger';
import type { SlackWebhookPayload, SlackUrlVerificationPayload } from '@/types/slack.types';

/**
 * Slack Event API endpoint.
 *
 * All requests are verified with HMAC-SHA256 before any processing.
 * Slack requires a response within 3 seconds — business logic runs
 * asynchronously after we acknowledge receipt.
 */
export async function POST(request: Request) {
  const { valid, body, error } = await verifySlackSignature(request);

  if (!valid) {
    logger.warn('Slack events: invalid signature', { error });
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: SlackWebhookPayload;
  try {
    payload = JSON.parse(body) as SlackWebhookPayload;
  } catch {
    logger.warn('Slack events: malformed JSON body');
    return new Response('Bad Request', { status: 400 });
  }

  // URL verification challenge — must respond synchronously
  if (payload.type === 'url_verification') {
    const { challenge } = payload as SlackUrlVerificationPayload;
    return NextResponse.json({ challenge });
  }

  // Process asynchronously — keep it attached to the request lifecycle
  after(() => {
    return slackEventService.handleEnvelope(payload).catch(err => {
      logger.error('Slack event processing error', {}, err);
    });
  });

  return NextResponse.json({ ok: true });
}
