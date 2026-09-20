import {
  RegistrationOptions,
  AuthenticationOptions,
  base64UrlToUint8Array,
  uint8ArrayToBase64Url,
} from '@zeroauth/core';

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
    throw new Error('WebAuthn is not supported in this browser environment');
  }

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
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Registration failed: no credential created');
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
}

/**
 * Trigger passkey authentication / login prompt in the browser
 */
export async function startPasskeyAuthentication(
  options: AuthenticationOptions,
  useConditionalUI = false
) {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser environment');
  }

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
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Authentication failed: no credential provided');
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
}
