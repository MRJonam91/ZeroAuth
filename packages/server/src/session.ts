import { generateChallenge, ZeroAuthUser } from '@zeroauth/core';
import type { ZeroAuthStorageAdapter, ZeroAuthSession } from './storage.js';

export interface SessionManagerOptions {
  storage: ZeroAuthStorageAdapter;
  sessionTtlSeconds?: number; // Default: 7 days (604,800 seconds)
  slidingExpiration?: boolean;
}

export class SessionManager {
  readonly storage: ZeroAuthStorageAdapter;
  readonly sessionTtlSeconds: number;
  readonly slidingExpiration: boolean;

  constructor(options: SessionManagerOptions) {
    this.storage = options.storage;
    this.sessionTtlSeconds = options.sessionTtlSeconds ?? 7 * 24 * 60 * 60;
    this.slidingExpiration = options.slidingExpiration ?? true;
  }

  /**
   * Create a new cryptographically secure session for a user
   */
  async createSession(userId: string): Promise<ZeroAuthSession> {
    const sessionId = 'za_sess_' + generateChallenge(32);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlSeconds * 1000);

    const session: ZeroAuthSession = {
      id: sessionId,
      userId,
      expiresAt,
      createdAt: now,
      lastActiveAt: now,
    };

    await this.storage.saveSession(session);
    return session;
  }

  /**
   * Validate a session token and retrieve associated user.
   * If slidingExpiration is true, extends session validity.
   */
  async validateSession(sessionId: string): Promise<{
    session: ZeroAuthSession;
    user: ZeroAuthUser;
  } | null> {
    const session = await this.storage.getSession(sessionId);
    if (!session) return null;

    const now = new Date();
    if (now > session.expiresAt) {
      await this.storage.deleteSession(sessionId);
      return null;
    }

    const user = await this.storage.getUserById(session.userId);
    if (!user) {
      await this.storage.deleteSession(sessionId);
      return null;
    }

    if (this.slidingExpiration) {
      session.lastActiveAt = now;
      session.expiresAt = new Date(now.getTime() + this.sessionTtlSeconds * 1000);
      await this.storage.saveSession(session);
    }

    return { session, user };
  }

  /**
   * Invalidate / delete a session (Logout)
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.storage.deleteSession(sessionId);
  }

  /**
   * Clean up expired sessions from storage
   */
  async pruneExpiredSessions(): Promise<void> {
    await this.storage.deleteExpiredSessions();
  }
}
