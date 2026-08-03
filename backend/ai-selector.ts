/**
 * AI selector module.
 * Decides whether to use a local Ollama instance or a cloud provider
 * based on the CLI arguments supplied by the user.
 */

export type CloudProvider = 'openai' | 'gemini' | 'anthropic';

/**
 * Discriminated union describing the resolved AI backend to use.
 * - mode 'local'  → use local Ollama
 * - mode 'cloud'  → use a REST cloud provider API
 */
export type AIConfig =
  | { mode: 'local'; modelName: string }
  | { mode: 'cloud'; provider: CloudProvider; apiKey: string; cloudModel: string };

/** Default cloud model names per provider. */
const DEFAULT_CLOUD_MODELS: Record<CloudProvider, string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
  anthropic: 'claude-3-5-haiku-latest',
};

export interface ParsedAIArgs {
  /** Ollama model name (local mode). */
  modelName: string;
  /** Cloud provider API key — presence triggers cloud mode. */
  apiKey?: string;
  /** Cloud provider name (default: openai). */
  provider?: string;
  /** Override the default cloud model for the chosen provider. */
  cloudModel?: string;
}

/**
 * Reads the parsed CLI arguments and returns the appropriate AIConfig.
 * If an API key is present the tool operates in cloud mode;
 * otherwise it falls back to local Ollama mode.
 */
export function selectAI(args: ParsedAIArgs): AIConfig {
  if (args.apiKey) {
    const provider = validateProvider(args.provider ?? 'openai');
    const cloudModel = args.cloudModel ?? DEFAULT_CLOUD_MODELS[provider];

    console.log(`AI mode  : ☁️  Cloud (${provider})`);
    console.log(`Model    : ${cloudModel}`);

    return { mode: 'cloud', provider, apiKey: args.apiKey, cloudModel };
  }

  console.log(`AI mode  : 🖥️  Local (Ollama)`);
  console.log(`Model    : ${args.modelName}`);

  return { mode: 'local', modelName: args.modelName };
}

function validateProvider(raw: string): CloudProvider {
  const valid: CloudProvider[] = ['openai', 'gemini', 'anthropic'];
  if (valid.includes(raw as CloudProvider)) {
    return raw as CloudProvider;
  }
  console.error(
    `Error: Unknown provider "${raw}". Valid options are: ${valid.join(', ')}.`
  );
  process.exit(1);
}
