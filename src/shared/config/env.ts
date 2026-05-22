import { z } from 'zod';

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const envSchema = z.object({
  VITE_APP_NAME: z.string().default('Livestream Admin'),
  VITE_APP_ENV: z.string().default('local'),
  VITE_API_BASE_URL: z.string().url().default('http://localhost:3000'),
  VITE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  VITE_AUTH_MODE: z.enum(['auth0', 'mock']).default('auth0'),
  VITE_AUTH0_DOMAIN: optionalTrimmedString,
  VITE_AUTH0_CLIENT_ID: optionalTrimmedString,
  VITE_AUTH0_AUDIENCE: optionalTrimmedString,
  VITE_MONITORING_ENDPOINT: z.string().url().optional().or(z.literal('')),
  VITE_MONITORING_ENV: optionalTrimmedString,
  VITE_BUILD_LABEL: optionalTrimmedString,
});

export type FrontendEnv = z.infer<typeof envSchema>;

const REQUIRED_AUTH0_ENV_KEYS = [
  'VITE_AUTH0_DOMAIN',
  'VITE_AUTH0_CLIENT_ID',
  'VITE_AUTH0_AUDIENCE',
] as const;

export const getAuth0ConfigIssue = (candidate: FrontendEnv): string | null => {
  if (candidate.VITE_AUTH_MODE !== 'auth0') {
    return null;
  }

  const missingKeys = REQUIRED_AUTH0_ENV_KEYS.filter((key) => !candidate[key]);
  if (missingKeys.length === 0) {
    return null;
  }

  return `Auth0 config is missing for VITE_AUTH_MODE=auth0. Set ${missingKeys.join(
    ', ',
  )}, or set VITE_AUTH_MODE=mock only for local mock auth.`;
};

export const parseFrontendEnv = (source: Record<string, unknown>): FrontendEnv => {
  return envSchema.parse(source);
};

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid env: ${parsedEnv.error.message}`);
}

export const env = parsedEnv.data;
