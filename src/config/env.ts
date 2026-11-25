export type AppEnvironment = 'development' | 'staging' | 'production';
export type DataProvider = 'firestore' | 'postgres';
export type AiProviderMode = 'gemini' | 'mock';

export interface RuntimeConfig {
  appEnv: AppEnvironment;
  dataProvider: DataProvider;
  aiProvider: AiProviderMode;
  port: number;
  appUrl: string;
  hasGeminiApiKey: boolean;
  hasSqlConfig: boolean;
}

const VALID_APP_ENVS: AppEnvironment[] = ['development', 'staging', 'production'];
const VALID_DATA_PROVIDERS: DataProvider[] = ['firestore', 'postgres'];
const VALID_AI_PROVIDERS: AiProviderMode[] = ['gemini', 'mock'];

export function resolveRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const rawAppEnv = (env.APP_ENV || (env.NODE_ENV === 'production' ? 'production' : 'development'))
    .trim()
    .toLowerCase() as AppEnvironment;
  const appEnv: AppEnvironment = VALID_APP_ENVS.includes(rawAppEnv) ? rawAppEnv : 'development';

  const rawDataProvider = (env.DATA_PROVIDER || 'firestore').trim().toLowerCase() as DataProvider;
  if (!VALID_DATA_PROVIDERS.includes(rawDataProvider)) {
    throw new Error(
      `Invalid DATA_PROVIDER "${env.DATA_PROVIDER}". Each environment must use exactly one primary provider: "firestore" or "postgres".`
    );
  }

  const rawAiProvider = (env.AI_PROVIDER || 'gemini').trim().toLowerCase() as AiProviderMode;
  if (!VALID_AI_PROVIDERS.includes(rawAiProvider)) {
    throw new Error(
      `Invalid AI_PROVIDER "${env.AI_PROVIDER}". Allowed values are "gemini" or "mock".`
    );
  }

  if (appEnv === 'production' && rawAiProvider === 'mock') {
    throw new Error(
      'AI_PROVIDER="mock" is strictly forbidden in production. Configure GEMINI_API_KEY and AI_PROVIDER="gemini".'
    );
  }

  const parsedPort = Number(env.PORT);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3000;

  return {
    appEnv,
    dataProvider: rawDataProvider,
    aiProvider: rawAiProvider,
    port,
    appUrl: (env.APP_URL || `http://localhost:${port}`).trim(),
    hasGeminiApiKey: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0),
    hasSqlConfig: Boolean(
      env.SQL_HOST && env.SQL_DB_NAME && env.SQL_USER && env.SQL_PASSWORD
    ),
  };
}
