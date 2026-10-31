import { betterAuth } from 'better-auth/minimal';
import { withCloudflare } from 'better-auth-cloudflare';

export interface AuthRuntimeEnv {
  DB: unknown;
  BETTER_AUTH_SECRET: string;
}

type NativeD1 = NonNullable<Parameters<typeof withCloudflare>[0]['d1Native']>;

export function createAuth(env: AuthRuntimeEnv, requestUrl: string) {
  if (typeof env.BETTER_AUTH_SECRET !== 'string' || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters.');
  }

  const origin = new URL(requestUrl).origin;
  return betterAuth({
    ...withCloudflare(
      {
        d1Native: env.DB as NativeD1,
        autoDetectIpAddress: false,
        geolocationTracking: false
      },
      {
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
      }
    )
  });
}
