import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_NAME: z.string().default('Livestream Admin'),
  VITE_APP_ENV: z.string().default('local'),
  VITE_API_BASE_URL: z.string().url().default('http://localhost:3000'),
  VITE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  VITE_AUTH_MODE: z.enum(['auth0', 'mock']).default('auth0'),
  VITE_AUTH0_DOMAIN: z.string().optional(),
  VITE_AUTH0_CLIENT_ID: z.string().optional(),
  VITE_AUTH0_AUDIENCE: z.string().optional(),
  VITE_MONITORING_ENDPOINT: z.string().url().optional().or(z.literal('')),
  VITE_MONITORING_ENV: z.string().optional(),
  VITE_BUILD_LABEL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid env: ${parsedEnv.error.message}`);
}

export const env = parsedEnv.data;
