import type {
  ZeroAuthUser,
  ZeroAuthCredential,
  ZeroAuthChallenge,
} from '@zeroauth/core';

export interface ZeroAuthSession {
  id: string; // Opaque secure session token
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface ZeroAuthStorageAdapter {
  // User Management
  getUserById(id: string): Promise<ZeroAuthUser | null>;
  getUserByUsername(username: string): Promise<ZeroAuthUser | null>;
  createUser(user: Omit<ZeroAuthUser, 'createdAt' | 'updatedAt'>): Promise<ZeroAuthUser>;

  // Credential Management
  getCredentialById(credentialId: string): Promise<ZeroAuthCredential | null>;
  listCredentialsByUserId(userId: string): Promise<ZeroAuthCredential[]>;
  saveCredential(credential: ZeroAuthCredential): Promise<void>;
  updateCredentialCounter(credentialId: string, counter: number): Promise<void>;
  updateCredentialName(credentialId: string, name: string): Promise<void>;
  deleteCredential(credentialId: string): Promise<void>;

  // Challenge Management
  saveChallenge(challenge: ZeroAuthChallenge): Promise<void>;
  getChallenge(challenge: string): Promise<ZeroAuthChallenge | null>;
  deleteChallenge(challenge: string): Promise<void>;

  // Session Management
  saveSession(session: ZeroAuthSession): Promise<void>;
  getSession(sessionId: string): Promise<ZeroAuthSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}

/**
 * In-Memory Storage Adapter (zero configuration, ideal for testing and fast prototyping)
 */
export class MemoryStorageAdapter implements ZeroAuthStorageAdapter {
  private usersById = new Map<string, ZeroAuthUser>();
  private usersByUsername = new Map<string, ZeroAuthUser>();
  private credentials = new Map<string, ZeroAuthCredential>();
  private challenges = new Map<string, ZeroAuthChallenge>();
  private sessions = new Map<string, ZeroAuthSession>();

  async getUserById(id: string): Promise<ZeroAuthUser | null> {
    return this.usersById.get(id) ?? null;
  }

  async getUserByUsername(username: string): Promise<ZeroAuthUser | null> {
    return this.usersByUsername.get(username.toLowerCase()) ?? null;
  }

  async createUser(data: Omit<ZeroAuthUser, 'createdAt' | 'updatedAt'>): Promise<ZeroAuthUser> {
    const now = new Date();
    const user: ZeroAuthUser = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.usersById.set(user.id, user);
    this.usersByUsername.set(user.username.toLowerCase(), user);
    return user;
  }

  async getCredentialById(credentialId: string): Promise<ZeroAuthCredential | null> {
    return this.credentials.get(credentialId) ?? null;
  }

  async listCredentialsByUserId(userId: string): Promise<ZeroAuthCredential[]> {
    const result: ZeroAuthCredential[] = [];
    for (const cred of this.credentials.values()) {
      if (cred.userId === userId) {
        result.push(cred);
      }
    }
    return result;
  }

  async saveCredential(credential: ZeroAuthCredential): Promise<void> {
    this.credentials.set(credential.id, credential);
  }

  async updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
    const cred = this.credentials.get(credentialId);
    if (cred) {
      cred.counter = counter;
      cred.lastUsedAt = new Date();
    }
  }

  async updateCredentialName(credentialId: string, name: string): Promise<void> {
    const cred = this.credentials.get(credentialId);
    if (cred) {
      cred.name = name;
    }
  }

  async deleteCredential(credentialId: string): Promise<void> {
    this.credentials.delete(credentialId);
  }

  async saveChallenge(challenge: ZeroAuthChallenge): Promise<void> {
    this.challenges.set(challenge.challenge, challenge);
  }

  async getChallenge(challenge: string): Promise<ZeroAuthChallenge | null> {
    const entry = this.challenges.get(challenge);
    if (!entry) return null;
    if (new Date() > entry.expiresAt) {
      this.challenges.delete(challenge);
      return null;
    }
    return entry;
  }

  async deleteChallenge(challenge: string): Promise<void> {
    this.challenges.delete(challenge);
  }

  async saveSession(session: ZeroAuthSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async getSession(sessionId: string): Promise<ZeroAuthSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async deleteExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [id, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }
}
