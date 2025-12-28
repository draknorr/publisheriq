import type { Message, Tool, LLMResponse, LLMProvider } from '../types';

export abstract class BaseLLMProvider implements LLMProvider {
  protected model: string;
  protected apiKey: string;

  constructor(apiKey: string, model: string) {
    if (!apiKey) {
      throw new Error(`API key required for ${this.constructor.name}`);
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  abstract chat(messages: Message[], tools?: Tool[]): Promise<LLMResponse>;
}
