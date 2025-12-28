import type { LLMProvider } from '../types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';

export type ProviderType = 'openai' | 'anthropic';

export function createProvider(type?: ProviderType): LLMProvider {
  const providerType = type || (process.env.LLM_PROVIDER as ProviderType) || 'openai';

  switch (providerType) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      return new OpenAIProvider(apiKey);
    }

    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      return new AnthropicProvider(apiKey);
    }

    default:
      throw new Error(`Unknown LLM provider: ${providerType}`);
  }
}

export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
