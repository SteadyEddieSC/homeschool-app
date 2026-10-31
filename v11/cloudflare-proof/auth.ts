import { betterAuth } from 'better-auth';

export interface AuthRuntimeEnv {
  DB: unknown;
  BETTER_AUTH_SECRET: string;
}

type BetterAuthDatabase = NonNullable<Parameters<typeof betterAuth>[0]['database']>;

export function createAuth(env: AuthRuntimeEnv, requestUrl: string) {
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
    rateLimit: {
      enabled: true,
      storage: 'database'
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
