import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  createContext,
  ReactNode,
} from 'react';
import {
  isWebAuthnSupported,
  isConditionalUIAvailable,
  startPasskeyRegistration,
  startPasskeyAuthentication,
} from '@zeroauth/client';
import type {
  RegistrationOptions,
  AuthenticationOptions,
  ZeroAuthUser,
} from '@zeroauth/core';

export * from '@zeroauth/client';
export * from './components.js';

export interface UsePasskeyReturn {
  isSupported: boolean;
  isAutofillSupported: boolean;
  isLoading: boolean;
  error: Error | null;
  register: (options: RegistrationOptions) => Promise<any>;
  authenticate: (options: AuthenticationOptions, autofill?: boolean) => Promise<any>;
}

/**
 * Low-level React hook to manage Passkey registration and login flows
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

// ==========================================
// High-Level React Authentication Context
// ==========================================

export interface ZeroAuthContextType {
  user: ZeroAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  register: (username: string, displayName?: string) => Promise<ZeroAuthUser>;
  login: (username?: string, autofill?: boolean) => Promise<ZeroAuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ZeroAuthContext = createContext<ZeroAuthContextType | undefined>(undefined);

export interface ZeroAuthProviderProps {
  children: ReactNode;
  apiBaseUrl?: string; // Default: '/api/auth'
}

/**
 * Full-featured Authentication Provider for React / Next.js
 */
export function ZeroAuthProvider({
  children,
  apiBaseUrl = '/api/auth',
}: ZeroAuthProviderProps) {
  const [user, setUser] = useState<ZeroAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const baseUrl = apiBaseUrl.replace(/\/+$/, '');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const register = useCallback(
    async (username: string, displayName?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Get options
        const optRes = await fetch(`${baseUrl}/register/options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, displayName }),
          credentials: 'include',
        });
        const options = await optRes.json();
        if (!optRes.ok || options.error) {
          throw new Error(options.error || 'Failed to get registration options');
        }

        // 2. Browser WebAuthn prompt
        const credential = await startPasskeyRegistration(options);

        // 3. Verify on server
        const verRes = await fetch(`${baseUrl}/register/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, displayName, response: credential }),
          credentials: 'include',
        });
        const verData = await verRes.json();
        if (!verRes.ok || verData.error) {
          throw new Error(verData.error || 'Failed to verify registration');
        }

        setUser(verData.user);
        return verData.user;
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [baseUrl]
  );

  const login = useCallback(
    async (username?: string, autofill = false) => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Get options
        const optRes = await fetch(`${baseUrl}/login/options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
          credentials: 'include',
        });
        const options = await optRes.json();
        if (!optRes.ok || options.error) {
          throw new Error(options.error || 'Failed to get login options');
        }

        // 2. Browser WebAuthn prompt
        const credential = await startPasskeyAuthentication(options, autofill);

        // 3. Verify on server
        const verRes = await fetch(`${baseUrl}/login/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response: credential }),
          credentials: 'include',
        });
        const verData = await verRes.json();
        if (!verRes.ok || verData.error) {
          throw new Error(verData.error || 'Failed to verify authentication');
        }

        setUser(verData.user);
        return verData.user;
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [baseUrl]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch(`${baseUrl}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl]);

  const value: ZeroAuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    error,
    register,
    login,
    logout,
    refresh,
  };

  return React.createElement(ZeroAuthContext.Provider, { value }, children);
}

/**
 * Access the global ZeroAuth authentication state in any React component
 */
export function useZeroAuth(): ZeroAuthContextType {
  const context = useContext(ZeroAuthContext);
  if (!context) {
    throw new Error('useZeroAuth must be used within a <ZeroAuthProvider>');
  }
  return context;
}
