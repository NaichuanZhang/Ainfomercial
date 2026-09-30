/**
 * Best-effort fixed-window rate limit, per serverless instance. Good enough to stop a
 * runaway client; not a security boundary.
 */
const windows = new Map<string, { start: number; count: number }>();

export function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || now - entry.start > windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 5_000) windows.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function isClientId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(value);
}
