import crypto from 'crypto';

/**
 * Generate an idempotency key for a task event
 */
export function generateIdempotencyKey(
  taskId: string,
  eventType: string,
  previousStatus: string | null,
  newStatus: string,
  timestamp: Date
): string {
  const data = `${taskId}-${eventType}-${previousStatus || 'null'}-${newStatus}-${timestamp.toISOString()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Sleep helper for polling intervals
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
