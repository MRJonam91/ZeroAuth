/**
 * Lightweight sliding-window Rate Limiter for ZeroAuth Challenge Endpoints
 * Protects against challenge flooding, DoS, and automated brute-force attempts.
 */

export interface RateLimiterOptions {
  maxRequests?: number; // Default: 30 requests
  windowMs?: number; // Default: 60,000 ms (1 minute)
}

interface WindowRecord {
  timestamps: number[];
}

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly clients = new Map<string, WindowRecord>();
  private lastPrune = Date.now();

  constructor(options?: RateLimiterOptions) {
    this.maxRequests = options?.maxRequests ?? 30;
    this.windowMs = options?.windowMs ?? 60_000;
  }

  /**
   * Check whether a client (IP or identifier) is allowed to perform a request
   */
  check(identifier: string): {
    allowed: boolean;
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();

    // Periodically prune stale clients (every 2 minutes)
    if (now - this.lastPrune > 120_000) {
      this.prune(now);
    }

    let record = this.clients.get(identifier);
    if (!record) {
      record = { timestamps: [] };
      this.clients.set(identifier, record);
    }

    // Filter out timestamps outside the active window
    const windowStart = now - this.windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0] ?? now;
      const resetMs = Math.max(0, oldest + this.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        resetMs,
      };
    }

    record.timestamps.push(now);
    const remaining = this.maxRequests - record.timestamps.length;
    const oldest = record.timestamps[0] ?? now;
    const resetMs = Math.max(0, oldest + this.windowMs - now);

    return {
      allowed: true,
      remaining,
      resetMs,
    };
  }

  private prune(now: number): void {
    this.lastPrune = now;
    const windowStart = now - this.windowMs;
    for (const [id, record] of this.clients.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      if (record.timestamps.length === 0) {
        this.clients.delete(id);
      }
    }
  }

  /**
   * Clear all records (useful for test isolation)
   */
  reset(): void {
    this.clients.clear();
  }
}
