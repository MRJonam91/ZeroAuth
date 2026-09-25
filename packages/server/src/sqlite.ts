import { DatabaseSync } from 'node:sqlite';
import type {
  ZeroAuthUser,
  ZeroAuthCredential,
  ZeroAuthChallenge,
} from '@zeroauth/core';
import type { ZeroAuthStorageAdapter } from './storage.js';

export interface SqliteStorageOptions {
  filename?: string; // ':memory:' or file path like './zeroauth.db'
}

/**
 * SQLite Storage Adapter using native Node.js 22/24 node:sqlite module
 * Zero external native compilers, zero dependencies, instant setup.
 */
export class SqliteStorageAdapter implements ZeroAuthStorageAdapter {
  private db: DatabaseSync;

  constructor(options?: SqliteStorageOptions) {
    const filename = options?.filename ?? ':memory:';
    this.db = new DatabaseSync(filename);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        displayName TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        publicKey BLOB NOT NULL,
        counter INTEGER NOT NULL,
        transports TEXT,
        deviceType TEXT,
        backedUp INTEGER,
        name TEXT,
        createdAt TEXT NOT NULL,
        lastUsedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS challenges (
        challenge TEXT PRIMARY KEY,
        userId TEXT,
        type TEXT NOT NULL,
        expiresAt TEXT NOT NULL
      );
    `);
  }

  async getUserById(id: string): Promise<ZeroAuthUser | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async getUserByUsername(username: string): Promise<ZeroAuthUser | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
    const row = stmt.get(username) as any;
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async createUser(data: Omit<ZeroAuthUser, 'createdAt' | 'updatedAt'>): Promise<ZeroAuthUser> {
    const now = new Date();
    const user: ZeroAuthUser = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, displayName, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.id,
      user.username,
      user.displayName ?? null,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    );

    return user;
  }

  async getCredentialById(credentialId: string): Promise<ZeroAuthCredential | null> {
    const stmt = this.db.prepare('SELECT * FROM credentials WHERE id = ?');
    const row = stmt.get(credentialId) as any;
    if (!row) return null;

    return this.mapCredentialRow(row);
  }

  async listCredentialsByUserId(userId: string): Promise<ZeroAuthCredential[]> {
    const stmt = this.db.prepare('SELECT * FROM credentials WHERE userId = ?');
    const rows = stmt.all(userId) as any[];
    return rows.map((r) => this.mapCredentialRow(r));
  }

  async saveCredential(credential: ZeroAuthCredential): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO credentials 
      (id, userId, publicKey, counter, transports, deviceType, backedUp, name, createdAt, lastUsedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      credential.id,
      credential.userId,
      Buffer.from(credential.publicKey),
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null,
      credential.deviceType ?? null,
      credential.backedUp ? 1 : 0,
      credential.name ?? null,
      credential.createdAt.toISOString(),
      credential.lastUsedAt ? credential.lastUsedAt.toISOString() : null
    );
  }

  async updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE credentials 
      SET counter = ?, lastUsedAt = ?
      WHERE id = ?
    `);
    stmt.run(counter, new Date().toISOString(), credentialId);
  }

  async deleteCredential(credentialId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM credentials WHERE id = ?');
    stmt.run(credentialId);
  }

  async saveChallenge(challenge: ZeroAuthChallenge): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO challenges (challenge, userId, type, expiresAt)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      challenge.challenge,
      challenge.userId ?? null,
      challenge.type,
      challenge.expiresAt.toISOString()
    );
  }

  async getChallenge(challenge: string): Promise<ZeroAuthChallenge | null> {
    const stmt = this.db.prepare('SELECT * FROM challenges WHERE challenge = ?');
    const row = stmt.get(challenge) as any;
    if (!row) return null;

    const expiresAt = new Date(row.expiresAt);
    if (new Date() > expiresAt) {
      await this.deleteChallenge(challenge);
      return null;
    }

    return {
      challenge: row.challenge,
      userId: row.userId ?? undefined,
      type: row.type as 'registration' | 'authentication',
      expiresAt,
    };
  }

  async deleteChallenge(challenge: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM challenges WHERE challenge = ?');
    stmt.run(challenge);
  }

  private mapCredentialRow(row: any): ZeroAuthCredential {
    return {
      id: row.id,
      userId: row.userId,
      publicKey: new Uint8Array(row.publicKey),
      counter: Number(row.counter),
      transports: row.transports ? JSON.parse(row.transports) : undefined,
      deviceType: row.deviceType ?? undefined,
      backedUp: Boolean(row.backedUp),
      name: row.name ?? undefined,
      createdAt: new Date(row.createdAt),
      lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : undefined,
    };
  }
}
