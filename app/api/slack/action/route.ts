import { verifySlackSignature } from '@/lib/slack';
import { slackActionService } from '@/services/slack-action.service';
import { logger } from '@/lib/logger';
import type { SlackBlockActionsPayload } from '@/types/slack.types';

/**
 * Slack interactive components endpoint (block_actions).
 *
 * All requests are verified with HMAC-SHA256 before processing.
 * Slack sends form-encoded data with a JSON "payload" field.
 */
export async function POST(request: Request) {
  const { valid, body, error } = await verifySlackSignature(request);

  if (!valid) {
    logger.warn('Slack action: invalid signature', { error });
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: SlackBlockActionsPayload;
  try {
    const formData = new URLSearchParams(body);
    const payloadStr = formData.get('payload');

    if (!payloadStr) {
      return new Response('Missing payload', { status: 400 });
    }

    payload = JSON.parse(payloadStr) as SlackBlockActionsPayload;
  } catch {
    logger.warn('Slack action: malformed payload');
    return new Response('Bad Request', { status: 400 });
  }

  if (payload.type !== 'block_actions') {
    return new Response('', { status: 200 });
  }

  try {
    await slackActionService.handlePayload(payload);
  } catch (err) {
    logger.error('Slack action processing failed', {}, err);
  }

  return new Response('', { status: 200 });
}
