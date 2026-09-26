import type {
  ZeroAuthUser,
  ZeroAuthCredential,
  ZeroAuthChallenge,
} from '@zeroauth/core';
import type { ZeroAuthStorageAdapter, ZeroAuthSession } from './storage.js';

/**
 * Minimal query interface compatible with pg.Pool, @vercel/postgres, Neon, and Supabase client
 */
export interface PgQueryResult<T = any> {
  rows: T[];
}

export interface PgClientLike {
  query(sql: string, params?: any[]): Promise<PgQueryResult>;
}

/**
 * Production-ready PostgreSQL Storage Adapter for ZeroAuth
 */
export class PostgresStorageAdapter implements ZeroAuthStorageAdapter {
  constructor(private client: PgClientLike) {}

  async getUserById(id: string): Promise<ZeroAuthUser | null> {
    const res = await this.client.query('SELECT * FROM zeroauth_users WHERE id = $1', [id]);
    const row = res.rows[0];
    if (!row) return null;
    return this.mapUserRow(row);
  }

  async getUserByUsername(username: string): Promise<ZeroAuthUser | null> {
    const res = await this.client.query(
      'SELECT * FROM zeroauth_users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    const row = res.rows[0];
    if (!row) return null;
    return this.mapUserRow(row);
  }

  async createUser(data: Omit<ZeroAuthUser, 'createdAt' | 'updatedAt'>): Promise<ZeroAuthUser> {
    const now = new Date();
    const user: ZeroAuthUser = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await this.client.query(
      `INSERT INTO zeroauth_users (id, username, display_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, user.username, user.displayName ?? null, user.createdAt, user.updatedAt]
    );

    return user;
  }

  async getCredentialById(credentialId: string): Promise<ZeroAuthCredential | null> {
    const res = await this.client.query(
      'SELECT * FROM zeroauth_credentials WHERE id = $1',
      [credentialId]
    );
    const row = res.rows[0];
    if (!row) return null;
    return this.mapCredentialRow(row);
  }

  async listCredentialsByUserId(userId: string): Promise<ZeroAuthCredential[]> {
    const res = await this.client.query(
      'SELECT * FROM zeroauth_credentials WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.rows.map((r) => this.mapCredentialRow(r));
  }

  async saveCredential(credential: ZeroAuthCredential): Promise<void> {
    await this.client.query(
      `INSERT INTO zeroauth_credentials 
       (id, user_id, public_key, counter, transports, device_type, backed_up, name, created_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         counter = EXCLUDED.counter,
         last_used_at = EXCLUDED.last_used_at`,
      [
        credential.id,
        credential.userId,
        Buffer.from(credential.publicKey),
        credential.counter,
        credential.transports ? JSON.stringify(credential.transports) : null,
        credential.deviceType ?? null,
        credential.backedUp ?? false,
        credential.name ?? null,
        credential.createdAt,
        credential.lastUsedAt ?? null,
      ]
    );
  }

  async updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
    await this.client.query(
      'UPDATE zeroauth_credentials SET counter = $1, last_used_at = $2 WHERE id = $3',
      [counter, new Date(), credentialId]
    );
  }

  async updateCredentialName(credentialId: string, name: string): Promise<void> {
    await this.client.query(
      'UPDATE zeroauth_credentials SET name = $1 WHERE id = $2',
      [name, credentialId]
    );
  }

  async deleteCredential(credentialId: string): Promise<void> {
    await this.client.query('DELETE FROM zeroauth_credentials WHERE id = $1', [credentialId]);
  }

  async saveChallenge(challenge: ZeroAuthChallenge): Promise<void> {
    await this.client.query(
      `INSERT INTO zeroauth_challenges (challenge, user_id, type, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (challenge) DO UPDATE SET
         expires_at = EXCLUDED.expires_at`,
      [challenge.challenge, challenge.userId ?? null, challenge.type, challenge.expiresAt]
    );
  }

  async getChallenge(challenge: string): Promise<ZeroAuthChallenge | null> {
    const res = await this.client.query(
      'SELECT * FROM zeroauth_challenges WHERE challenge = $1',
      [challenge]
    );
    const row = res.rows[0];
    if (!row) return null;

    const expiresAt = new Date(row.expires_at);
    if (new Date() > expiresAt) {
      await this.deleteChallenge(challenge);
      return null;
    }

    return {
      challenge: row.challenge,
      userId: row.user_id ?? undefined,
      type: row.type,
      expiresAt,
    };
  }

  async deleteChallenge(challenge: string): Promise<void> {
    await this.client.query('DELETE FROM zeroauth_challenges WHERE challenge = $1', [challenge]);
  }

  async saveSession(session: ZeroAuthSession): Promise<void> {
    await this.client.query(
      `INSERT INTO zeroauth_sessions (id, user_id, expires_at, created_at, last_active_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         last_active_at = EXCLUDED.last_active_at,
         expires_at = EXCLUDED.expires_at`,
      [session.id, session.userId, session.expiresAt, session.createdAt, session.lastActiveAt]
    );
  }

  async getSession(sessionId: string): Promise<ZeroAuthSession | null> {
    const res = await this.client.query(
      'SELECT * FROM zeroauth_sessions WHERE id = $1',
      [sessionId]
    );
    const row = res.rows[0];
    if (!row) return null;

    const expiresAt = new Date(row.expires_at);
    if (new Date() > expiresAt) {
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      expiresAt,
      createdAt: new Date(row.created_at),
      lastActiveAt: new Date(row.last_active_at),
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.query('DELETE FROM zeroauth_sessions WHERE id = $1', [sessionId]);
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.client.query('DELETE FROM zeroauth_sessions WHERE expires_at < $1', [new Date()]);
  }

  private mapUserRow(row: any): ZeroAuthUser {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapCredentialRow(row: any): ZeroAuthCredential {
    return {
      id: row.id,
      userId: row.user_id,
      publicKey: new Uint8Array(row.public_key),
      counter: Number(row.counter),
      transports: row.transports ? (typeof row.transports === 'string' ? JSON.parse(row.transports) : row.transports) : undefined,
      deviceType: row.device_type ?? undefined,
      backedUp: Boolean(row.backed_up),
      name: row.name ?? undefined,
      createdAt: new Date(row.created_at),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    };
  }
}
