import {
  RegistrationOptions,
  AuthenticationOptions,
  base64UrlToUint8Array,
  uint8ArrayToBase64Url,
} from '@zeroauth/core';

export type ZeroAuthErrorCode =
  | 'NOT_SUPPORTED'
  | 'USER_CANCELLED'
  | 'TIMEOUT'
  | 'INVALID_STATE'
  | 'SECURITY_ERROR'
  | 'UNKNOWN';

export class ZeroAuthClientError extends Error {
  readonly code: ZeroAuthErrorCode;
  readonly originalError?: unknown;

  constructor(message: string, code: ZeroAuthErrorCode, originalError?: unknown) {
    super(message);
    this.name = 'ZeroAuthClientError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Normalizes browser DOMExceptions (NotAllowedError, SecurityError, etc.) into clean ZeroAuthClientErrors
 */
export function normalizeWebAuthnError(err: any): ZeroAuthClientError {
  if (err instanceof ZeroAuthClientError) return err;

  const errorName = err?.name;
  const message = err?.message || 'WebAuthn error occurred';

  switch (errorName) {
    case 'NotAllowedError':
      return new ZeroAuthClientError(
        'Operation cancelled by user or timed out.',
        'USER_CANCELLED',
        err
      );
    case 'InvalidStateError':
      return new ZeroAuthClientError(
        'This authenticator or passkey is already registered.',
        'INVALID_STATE',
        err
      );
    case 'SecurityError':
      return new ZeroAuthClientError(
        'The operation is insecure or origin does not match rpId.',
        'SECURITY_ERROR',
        err
      );
    case 'TimeoutError':
      return new ZeroAuthClientError(
        'The passkey operation timed out.',
        'TIMEOUT',
        err
      );
    case 'NotSupportedError':
      return new ZeroAuthClientError(
        'The requested credential algorithm or feature is not supported by this device.',
        'NOT_SUPPORTED',
        err
      );
    default:
      return new ZeroAuthClientError(message, 'UNKNOWN', err);
  }
}

/**
 * Check if the current browser environment supports the WebAuthn API
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  );
}

/**
 * Check if the browser supports Conditional UI (Passkey Autofill in input fields)
 */
export async function isConditionalUIAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  if ('isConditionalMediationAvailable' in PublicKeyCredential) {
    return await (PublicKeyCredential as any).isConditionalMediationAvailable();
  }
  return false;
}

/**
 * Trigger passkey registration prompt in the browser
 */
export async function startPasskeyRegistration(options: RegistrationOptions) {
  if (!isWebAuthnSupported()) {
    throw new ZeroAuthClientError(
      'WebAuthn is not supported in this browser environment',
      'NOT_SUPPORTED'
    );
  }

  try {
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      rp: options.rp,
      user: {
        id: new TextEncoder().encode(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      challenge: base64UrlToUint8Array(options.challenge) as unknown as BufferSource,
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      authenticatorSelection: options.authenticatorSelection,
      attestation: options.attestation ?? 'none',
      excludeCredentials: options.excludeCredentials?.map(
        (c: NonNullable<RegistrationOptions['excludeCredentials']>[number]) => ({
          id: base64UrlToUint8Array(c.id) as unknown as BufferSource,
          type: c.type,
          transports: c.transports,
        })
      ),
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
      signal: (options as any).signal,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new ZeroAuthClientError('Registration failed: no credential created', 'UNKNOWN');
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    return {
      id: credential.id,
      rawId: uint8ArrayToBase64Url(new Uint8Array(credential.rawId)),
      type: credential.type,
      response: {
        clientDataJSON: uint8ArrayToBase64Url(new Uint8Array(response.clientDataJSON)),
        attestationObject: uint8ArrayToBase64Url(new Uint8Array(response.attestationObject)),
      },
    };
  } catch (err: any) {
    throw normalizeWebAuthnError(err);
  }
}

/**
 * Trigger passkey authentication / login prompt in the browser
 */
export async function startPasskeyAuthentication(
  options: AuthenticationOptions & { signal?: AbortSignal },
  useConditionalUI = false
) {
  if (!isWebAuthnSupported()) {
    throw new ZeroAuthClientError(
      'WebAuthn is not supported in this browser environment',
      'NOT_SUPPORTED'
    );
  }

  try {
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64UrlToUint8Array(options.challenge) as unknown as BufferSource,
      timeout: options.timeout,
      rpId: options.rpId,
      userVerification: options.userVerification,
      allowCredentials: options.allowCredentials?.map(
        (c: NonNullable<AuthenticationOptions['allowCredentials']>[number]) => ({
          id: base64UrlToUint8Array(c.id) as unknown as BufferSource,
          type: c.type,
          transports: c.transports,
        })
      ),
    };

    const credential = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
      mediation: useConditionalUI ? 'conditional' : 'optional',
      signal: options.signal,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new ZeroAuthClientError('Authentication failed: no credential provided', 'UNKNOWN');
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      id: credential.id,
      rawId: uint8ArrayToBase64Url(new Uint8Array(credential.rawId)),
      type: credential.type,
      response: {
        clientDataJSON: uint8ArrayToBase64Url(new Uint8Array(response.clientDataJSON)),
        authenticatorData: uint8ArrayToBase64Url(new Uint8Array(response.authenticatorData)),
        signature: uint8ArrayToBase64Url(new Uint8Array(response.signature)),
        userHandle: response.userHandle
          ? uint8ArrayToBase64Url(new Uint8Array(response.userHandle))
          : undefined,
      },
    };
  } catch (err: any) {
    throw normalizeWebAuthnError(err);
  }
}
