import {
  generateChallenge,
  RelyingPartyConfig,
  RegistrationOptions,
  AuthenticationOptions,
  COSEAlgorithm,
} from '@zeroauth/core';
import { ZeroAuthStorageAdapter, MemoryStorageAdapter } from './storage.js';

export * from './storage.js';

export interface ZeroAuthServerOptions {
  rp: RelyingPartyConfig;
  storage?: ZeroAuthStorageAdapter;
  challengeTtlSeconds?: number;
}

export class ZeroAuthServer {
  readonly rp: RelyingPartyConfig;
  readonly storage: ZeroAuthStorageAdapter;
  readonly challengeTtlSeconds: number;

  constructor(options: ZeroAuthServerOptions) {
    this.rp = options.rp;
    this.storage = options.storage ?? new MemoryStorageAdapter();
    this.challengeTtlSeconds = options.challengeTtlSeconds ?? 120;
  }

  /**
   * Generates registration challenge and options for a new passkey credential
   */
  async createRegistrationOptions(params: {
    username: string;
    displayName?: string;
    userId?: string;
  }): Promise<RegistrationOptions> {
    const challenge = generateChallenge();
    const expiresAt = new Date(Date.now() + this.challengeTtlSeconds * 1000);

    const userId = params.userId ?? generateChallenge(16);

    await this.storage.saveChallenge({
      challenge,
      userId,
      type: 'registration',
      expiresAt,
    });

    const existingCreds = await this.storage.listCredentialsByUserId(userId);

    return {
      rp: {
        name: this.rp.name,
        id: this.rp.id,
      },
      user: {
        id: userId,
        name: params.username,
        displayName: params.displayName ?? params.username,
      },
      challenge,
      pubKeyCredParams: [
        { type: 'public-key', alg: COSEAlgorithm.ES256 },
        { type: 'public-key', alg: COSEAlgorithm.EdDSA },
        { type: 'public-key', alg: COSEAlgorithm.RS256 },
      ],
      timeout: this.challengeTtlSeconds * 1000,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existingCreds.map((c) => ({
        id: c.id,
        type: 'public-key',
        transports: c.transports,
      })),
    };
  }

  /**
   * Generates authentication challenge and options for logging in with a passkey
   */
  async createAuthenticationOptions(params?: {
    userId?: string;
  }): Promise<AuthenticationOptions> {
    const challenge = generateChallenge();
    const expiresAt = new Date(Date.now() + this.challengeTtlSeconds * 1000);

    await this.storage.saveChallenge({
      challenge,
      userId: params?.userId,
      type: 'authentication',
      expiresAt,
    });

    let allowCredentials: AuthenticationOptions['allowCredentials'];

    if (params?.userId) {
      const creds = await this.storage.listCredentialsByUserId(params.userId);
      allowCredentials = creds.map((c) => ({
        id: c.id,
        type: 'public-key',
        transports: c.transports,
      }));
    }

    return {
      challenge,
      timeout: this.challengeTtlSeconds * 1000,
      rpId: this.rp.id,
      allowCredentials,
      userVerification: 'preferred',
    };
  }
}
