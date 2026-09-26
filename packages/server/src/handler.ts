import { ZeroAuthServer } from './index.js';
import { SessionManager } from './session.js';

export interface ZeroAuthHandlerOptions {
  basePath?: string; // Default: '/api/auth'
  cookieName?: string; // Default: 'zeroauth_session'
  sessionManager?: SessionManager;
}

/**
 * Universal Web Standard Request/Response Handler for ZeroAuth
 * Directly compatible with Next.js App Router, Hono, SvelteKit, Astro, Cloudflare Workers, and Bun.
 */
export function createZeroAuthHandler(
  server: ZeroAuthServer,
  options?: ZeroAuthHandlerOptions
) {
  const basePath = (options?.basePath ?? '/api/auth').replace(/\/+$/, '');
  const cookieName = options?.cookieName ?? 'zeroauth_session';
  const sessionManager = options?.sessionManager ?? new SessionManager({ storage: server.storage });

  return async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Helper for JSON responses
    function json(data: any, status = 200, headers: Record<string, string> = {}): Response {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
    }

    // Helper to extract client identifier (IP address) for rate-limiting
    function getClientIdentifier(): string {
      return (
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'client-ip'
      );
    }

    // Helper to extract session ID from Cookie header or Authorization header
    function extractSessionId(): string | null {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
      }

      const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').map((c) => c.trim());
        for (const cookie of cookies) {
          if (cookie.startsWith(`${cookieName}=`)) {
            return decodeURIComponent(cookie.slice(cookieName.length + 1));
          }
        }
      }
      return null;
    }

    // Helper to create Set-Cookie header
    function makeCookieHeader(sessionId: string, maxAgeSeconds: number): string {
      const isSecure = url.protocol === 'https:';
      return `${cookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${isSecure ? '; Secure' : ''}`;
    }

    try {
      // 1. POST /register/options
      if (request.method === 'POST' && path === `${basePath}/register/options`) {
        const body = (await request.json()) as any;
        if (!body.username) {
          return json({ error: 'Username is required' }, 400);
        }
        const regOptions = await server.createRegistrationOptions({
          username: body.username,
          displayName: body.displayName,
          clientIdentifier: getClientIdentifier(),
        });
        return json(regOptions);
      }

      // 2. POST /register/verify
      if (request.method === 'POST' && path === `${basePath}/register/verify`) {
        const body = (await request.json()) as any;
        const result = await server.verifyRegistration({
          username: body.username,
          displayName: body.displayName,
          response: body.response,
          credentialName: body.credentialName,
        });

        const session = await sessionManager.createSession(result.user.id);
        const cookie = makeCookieHeader(session.id, sessionManager.sessionTtlSeconds);

        return json(
          {
            success: true,
            user: result.user,
            token: session.id,
          },
          200,
          { 'Set-Cookie': cookie }
        );
      }

      // 3. POST /login/options
      if (request.method === 'POST' && path === `${basePath}/login/options`) {
        let body: any = {};
        try {
          body = await request.json();
        } catch {}
        const authOptions = await server.createAuthenticationOptions({
          username: body?.username,
          clientIdentifier: getClientIdentifier(),
        });
        return json(authOptions);
      }

      // 4. POST /login/verify
      if (request.method === 'POST' && path === `${basePath}/login/verify`) {
        const body = (await request.json()) as any;
        const result = await server.verifyAuthentication({
          response: body.response,
        });

        const session = await sessionManager.createSession(result.user.id);
        const cookie = makeCookieHeader(session.id, sessionManager.sessionTtlSeconds);

        return json(
          {
            success: true,
            user: result.user,
            token: session.id,
          },
          200,
          { 'Set-Cookie': cookie }
        );
      }

      // 5. GET /me (Get currently authenticated user)
      if (request.method === 'GET' && path === `${basePath}/me`) {
        const sessionId = extractSessionId();
        if (!sessionId) {
          return json({ user: null, authenticated: false }, 200);
        }

        const auth = await sessionManager.validateSession(sessionId);
        if (!auth) {
          return json({ user: null, authenticated: false }, 200);
        }

        return json({
          authenticated: true,
          user: auth.user,
        });
      }

      // 6. POST /logout
      if (request.method === 'POST' && path === `${basePath}/logout`) {
        const sessionId = extractSessionId();
        if (sessionId) {
          await sessionManager.revokeSession(sessionId);
        }
        const expiredCookie = `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
        return json({ success: true }, 200, { 'Set-Cookie': expiredCookie });
      }

      // 7. GET /credentials (List user credentials)
      if (request.method === 'GET' && path === `${basePath}/credentials`) {
        const sessionId = extractSessionId();
        if (!sessionId) return json({ error: 'Unauthorized' }, 401);
        const auth = await sessionManager.validateSession(sessionId);
        if (!auth) return json({ error: 'Unauthorized' }, 401);

        const credentials = await server.listUserCredentials(auth.user.id);
        return json({
          credentials: credentials.map((c) => ({
            id: c.id,
            name: c.name,
            deviceType: c.deviceType,
            backedUp: c.backedUp,
            createdAt: c.createdAt,
            lastUsedAt: c.lastUsedAt,
          })),
        });
      }

      // 8. PATCH /credentials (Rename a credential)
      if (request.method === 'PATCH' && path === `${basePath}/credentials`) {
        const sessionId = extractSessionId();
        if (!sessionId) return json({ error: 'Unauthorized' }, 401);
        const auth = await sessionManager.validateSession(sessionId);
        if (!auth) return json({ error: 'Unauthorized' }, 401);

        const body = (await request.json()) as any;
        if (!body.credentialId || !body.name) {
          return json({ error: 'credentialId and name are required' }, 400);
        }

        await server.renameCredential(body.credentialId, body.name);
        return json({ success: true });
      }

      // 9. DELETE /credentials (Revoke a credential)
      if (request.method === 'DELETE' && path === `${basePath}/credentials`) {
        const sessionId = extractSessionId();
        if (!sessionId) return json({ error: 'Unauthorized' }, 401);
        const auth = await sessionManager.validateSession(sessionId);
        if (!auth) return json({ error: 'Unauthorized' }, 401);

        const body = (await request.json()) as any;
        if (!body.credentialId) {
          return json({ error: 'credentialId is required' }, 400);
        }

        await server.revokeCredential(body.credentialId);
        return json({ success: true });
      }

      // Unknown route
      return json({ error: `Not Found: ${request.method} ${path}` }, 404);
    } catch (err: any) {
      return json({ error: err.message || 'Internal Server Error' }, 400);
    }
  };
}
