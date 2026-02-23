export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auditService } from '@/services/audit.service';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Internal cron endpoint — runs the daily guest inactivity audit.
 *
 * Triggered by Vercel Cron (see vercel.json) at 00:00 UTC daily.
 * Protected by Bearer token authentication.
 * Supports GET (Vercel Cron default) and POST (manual/internal calls).
 *
 * All business logic lives in AuditService. This handler is a thin controller.
 */
async function runAudit(request: Request) {
  const authHeader = request.headers.get('Authorization');

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    logger.warn('Audit cron: unauthorized request');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await auditService.auditAllActiveWorkspaces();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error('Audit cron: unexpected failure', {}, err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function GET(request: Request) {
  return runAudit(request);
}

export async function POST(request: Request) {
  return runAudit(request);
}
