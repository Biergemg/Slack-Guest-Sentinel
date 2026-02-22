/**
 * Structured logger.
 *
 * Replaces scattered console.error / console.log calls with consistent,
 * context-rich log entries.
 *
 * - In production: outputs JSON for log aggregators (Datadog, Logtail, etc.)
 * - In development: outputs human-readable text to the terminal
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Audit completed', { workspaceId, flagged: 3 });
 *   logger.error('DM failed', { guestId }, err);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    name: string;
    stack?: string;
  };
}

function serializeError(err: unknown): LogEntry['error'] | undefined {
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    };
  }
  if (err !== undefined && err !== null) {
    return { message: String(err), name: 'UnknownError' };
  }
  return undefined;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>, err?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context !== undefined && Object.keys(context).length > 0 && { context }),
    ...(err !== undefined && { error: serializeError(err) }),
  };

  const isProduction = process.env.NODE_ENV === 'production';

  let formatted: string;
  if (isProduction) {
    // Structured JSON for log aggregators
    formatted = JSON.stringify(entry);
  } else {
    // Human-readable for local development
    const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const errStr = entry.error ? ` | ERR: ${entry.error.message}` : '';
    formatted = `[${entry.level.toUpperCase()}] ${entry.timestamp} ${entry.message}${ctx}${errStr}`;
  }

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    emit('debug', message, context),

  info: (message: string, context?: Record<string, unknown>) =>
    emit('info', message, context),

  warn: (message: string, context?: Record<string, unknown>, err?: unknown) =>
    emit('warn', message, context, err),

  error: (message: string, context?: Record<string, unknown>, err?: unknown) =>
    emit('error', message, context, err),
};
