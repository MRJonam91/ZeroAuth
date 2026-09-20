import { useState, useEffect, useCallback } from 'react';
import {
  isWebAuthnSupported,
  isConditionalUIAvailable,
  startPasskeyRegistration,
  startPasskeyAuthentication,
} from '@zeroauth/client';
import type { RegistrationOptions, AuthenticationOptions } from '@zeroauth/core';

export interface UsePasskeyReturn {
  isSupported: boolean;
  isAutofillSupported: boolean;
  isLoading: boolean;
  error: Error | null;
  register: (options: RegistrationOptions) => Promise<any>;
  authenticate: (options: AuthenticationOptions, autofill?: boolean) => Promise<any>;
}

/**
 * React hook to manage Passkey registration and login flows
 */
export function usePasskey(): UsePasskeyReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isAutofillSupported, setIsAutofillSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsSupported(isWebAuthnSupported());
    isConditionalUIAvailable().then(setIsAutofillSupported).catch(() => {});
  }, []);

  const register = useCallback(async (options: RegistrationOptions) => {
    setIsLoading(true);
    setError(null);
    try {
      const cred = await startPasskeyRegistration(options);
      return cred;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const authenticate = useCallback(
    async (options: AuthenticationOptions, autofill = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const cred = await startPasskeyAuthentication(options, autofill);
        return cred;
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isSupported,
    isAutofillSupported,
    isLoading,
    error,
    register,
    authenticate,
  };
}
