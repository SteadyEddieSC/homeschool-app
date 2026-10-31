import { betterAuth } from 'better-auth';

export interface AuthRuntimeEnv {
  DB: unknown;
  APP_ENV: string;
  BETTER_AUTH_SECRET: string;
}

type BetterAuthDatabase = NonNullable<Parameters<typeof betterAuth>[0]['database']>;

export function createAuth(env: AuthRuntimeEnv, requestUrl: string) {
  if (env.APP_ENV !== 'local-proof') {
    throw new Error('AUTH-FOUNDATION-001 auth adapter is restricted to APP_ENV=local-proof.');
  }
  if (typeof env.BETTER_AUTH_SECRET !== 'string' || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters.');
  }

  const origin = new URL(requestUrl).origin;
  return betterAuth({
    database: env.DB as BetterAuthDatabase,
    baseURL: origin,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24
    },
    // Better Auth's built-in limiter is keyed by client IP. This bounded local
    // proof intentionally collects no client IP, so rate limiting is disabled
    // rather than implying an IP-free limiter exists. A hosted rollout must
    // choose and prove its abuse-control/privacy boundary separately.
    rateLimit: {
      enabled: false
    },
    advanced: {
      ipAddress: {
        disableIpTracking: true
      },
      database: {
        validateSchema: true
      }
    }
  });
}
