import { BaseLLMProvider } from './base';
import type { Message, Tool, LLMResponse } from '../types';

export class AnthropicProvider extends BaseLLMProvider {
  constructor(apiKey: string, model = 'claude-3-haiku-20240307') {
    super(apiKey, model);
  }

  async chat(_messages: Message[], _tools?: Tool[]): Promise<LLMResponse> {
    // TODO: Implement Anthropic API integration
    // Will use /v1/messages endpoint with tool_use support
    throw new Error('Anthropic provider not yet implemented. Set LLM_PROVIDER=openai');
  }
}
