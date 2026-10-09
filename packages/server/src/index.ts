import {
  generateChallenge,
  RelyingPartyConfig,
  RegistrationOptions,
  AuthenticationOptions,
  COSEAlgorithm,
  ZeroAuthUser,
  ZeroAuthCredential,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  parseClientData,
  lookupAAGUID,
  aaguidBytesToUuid,
} from '@zeroauth/core';
import { ZeroAuthStorageAdapter, MemoryStorageAdapter } from './storage.js';
import { RateLimiter } from './rate-limiter.js';

export * from './storage.js';
export * from './sqlite.js';
export * from './postgres.js';
export * from './session.js';
export * from './handler.js';
export * from './rate-limiter.js';

/**
 * Print a discrete terminal banner acknowledging zero-cost self-hosting and sponsor link
 */
export function printSponsorBanner(): void {
  if (process.env['ZEROAUTH_SILENT'] === '1' || process.env['NODE_ENV'] === 'test') {
    return;
  }
  console.log(
    '\x1b[36m🔑 ZeroAuth\x1b[0m \x1b[90m(Self-hosted Passkeys) - 100% free & open-source.\x1b[0m\n' +
    '\x1b[90m   Support development: https://github.com/sponsors/MRJonam91 | https://paypal.me/manorollo\x1b[0m\n'
  );
}

export interface ZeroAuthServerOptions {
  rp: RelyingPartyConfig;
  storage?: ZeroAuthStorageAdapter;
  challengeTtlSeconds?: number;
  silent?: boolean;
  rateLimiter?: RateLimiter | null;
}

export class ZeroAuthServer {
  readonly rp: RelyingPartyConfig;
  readonly storage: ZeroAuthStorageAdapter;
  readonly challengeTtlSeconds: number;
  readonly rateLimiter: RateLimiter | null;

  constructor(options: ZeroAuthServerOptions) {
    this.rp = options.rp;
    this.storage = options.storage ?? new MemoryStorageAdapter();
    this.challengeTtlSeconds = options.challengeTtlSeconds ?? 120;
    this.rateLimiter = options.rateLimiter !== undefined ? options.rateLimiter : new RateLimiter();
    if (!options.silent) {
      printSponsorBanner();
    }
  }

  /**
   * Generates registration challenge and options for a new passkey credential
   */
  async createRegistrationOptions(params: {
    username: string;
    displayName?: string;
    userId?: string;
    clientIdentifier?: string;
  }): Promise<RegistrationOptions> {
    if (this.rateLimiter && params.clientIdentifier) {
      const check = this.rateLimiter.check(params.clientIdentifier);
      if (!check.allowed) {
        throw new Error(`Too many registration requests. Try again in ${Math.ceil(check.resetMs / 1000)} seconds.`);
      }
    }

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
   * Verifies an attestation response and stores the newly created credential
   */
  async verifyRegistration(params: {
    response: {
      clientDataJSON: string;
      attestationObject: string;
    };
    username: string;
    displayName?: string;
    requireUserVerification?: boolean;
    credentialName?: string;
  }): Promise<{
    verified: boolean;
    user: ZeroAuthUser;
    credential: ZeroAuthCredential;
  }> {
    const { clientData } = parseClientData(params.response.clientDataJSON);

    const challengeRecord = await this.storage.getChallenge(clientData.challenge);
    if (!challengeRecord || challengeRecord.type !== 'registration') {
      throw new Error('Registration challenge not found or expired');
    }

    const verification = await verifyRegistrationResponse({
      response: params.response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: this.rp.origin,
      expectedRpId: this.rp.id,
      requireUserVerification: params.requireUserVerification,
    });

    // Invalidate challenge
    await this.storage.deleteChallenge(challengeRecord.challenge);

    // Get or create user
    let user = await this.storage.getUserByUsername(params.username);
    if (!user) {
      user = await this.storage.createUser({
        id: challengeRecord.userId ?? generateChallenge(16),
        username: params.username,
        displayName: params.displayName,
      });
    }

    // Resolve hardware device metadata from AAGUID if present
    const rawAaguid = verification.credential.aaguid;
    const aaguidStr = rawAaguid ? aaguidBytesToUuid(rawAaguid) : undefined;
    const aaguidMeta = rawAaguid ? lookupAAGUID(rawAaguid) : null;
    const defaultName = params.credentialName || aaguidMeta?.name || 'Passkey Device';

    const now = new Date();
    const credentialRecord: ZeroAuthCredential = {
      id: verification.credential.id,
      userId: user.id,
      publicKey: verification.credential.publicKey,
      counter: verification.credential.counter,
      deviceType: verification.credential.deviceType,
      backedUp: verification.credential.backedUp,
      name: defaultName,
      aaguid: aaguidStr,
      createdAt: now,
      lastUsedAt: now,
    };

    await this.storage.saveCredential(credentialRecord);

    return {
      verified: true,
      user,
      credential: credentialRecord,
    };
  }

  /**
   * Generates authentication challenge and options for logging in with a passkey
   */
  async createAuthenticationOptions(params?: {
    userId?: string;
    username?: string;
    clientIdentifier?: string;
  }): Promise<AuthenticationOptions> {
    if (this.rateLimiter && params?.clientIdentifier) {
      const check = this.rateLimiter.check(params.clientIdentifier);
      if (!check.allowed) {
        throw new Error(`Too many authentication requests. Try again in ${Math.ceil(check.resetMs / 1000)} seconds.`);
      }
    }

    const challenge = generateChallenge();
    const expiresAt = new Date(Date.now() + this.challengeTtlSeconds * 1000);

    let targetUserId = params?.userId;
    if (!targetUserId && params?.username) {
      const user = await this.storage.getUserByUsername(params.username);
      if (user) {
        targetUserId = user.id;
      }
    }

    await this.storage.saveChallenge({
      challenge,
      userId: targetUserId,
      type: 'authentication',
      expiresAt,
    });

    let allowCredentials: AuthenticationOptions['allowCredentials'];

    if (targetUserId) {
      const creds = await this.storage.listCredentialsByUserId(targetUserId);
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

  /**
   * Verifies an assertion response, updates the signature counter, and returns the authenticated user
   */
  async verifyAuthentication(params: {
    response: {
      id: string;
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
      userHandle?: string;
    };
    requireUserVerification?: boolean;
  }): Promise<{
    verified: boolean;
    user: ZeroAuthUser;
    credential: ZeroAuthCredential;
  }> {
    const { clientData } = parseClientData(params.response.clientDataJSON);

    const challengeRecord = await this.storage.getChallenge(clientData.challenge);
    if (!challengeRecord || challengeRecord.type !== 'authentication') {
      throw new Error('Authentication challenge not found or expired');
    }

    // Retrieve credential from storage
    const credential = await this.storage.getCredentialById(params.response.id);
    if (!credential) {
      throw new Error(`Credential with id "${params.response.id}" not found`);
    }

    const verification = await verifyAuthenticationResponse({
      response: params.response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: this.rp.origin,
      expectedRpId: this.rp.id,
      credentialPublicKey: credential.publicKey,
      previousCounter: credential.counter,
      requireUserVerification: params.requireUserVerification,
    });

    // Invalidate challenge
    await this.storage.deleteChallenge(challengeRecord.challenge);

    // Update credential counter
    await this.storage.updateCredentialCounter(credential.id, verification.newCounter);
    credential.counter = verification.newCounter;

    // Get user
    const user = await this.storage.getUserById(credential.userId);
    if (!user) {
      throw new Error(`User with id "${credential.userId}" not found`);
    }

    return {
      verified: true,
      user,
      credential,
    };
  }

  // ==========================================
  // Multi-Passkey Management API
  // ==========================================

  /**
   * List all registered passkeys for a user
   */
  async listUserCredentials(userId: string): Promise<ZeroAuthCredential[]> {
    return this.storage.listCredentialsByUserId(userId);
  }

  /**
   * Rename a registered passkey (e.g. "Work MacBook Touch ID")
   */
  async renameCredential(credentialId: string, name: string): Promise<void> {
    await this.storage.updateCredentialName(credentialId, name);
  }

  /**
   * Revoke/delete a specific passkey
   */
  async revokeCredential(credentialId: string): Promise<void> {
    await this.storage.deleteCredential(credentialId);
  }
}
