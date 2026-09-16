import { AIProvider } from './AIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { MockAIProvider } from './MockAIProvider.js';
import { GeminiKeyPoolManager } from './GeminiKeyPoolManager.js';

export class AIProviderFactory {
  private keyPool: GeminiKeyPoolManager;
  private mockProvider: MockAIProvider;

  constructor(keyPool: GeminiKeyPoolManager) {
    this.keyPool = keyPool;
    this.mockProvider = new MockAIProvider();
  }

  public async getProvider(): Promise<AIProvider> {
    const mode = process.env.APP_MODE || 'DEVELOPMENT';
    const activeKey = await this.keyPool.getNextActiveKey();

    if (activeKey) {
      return new GeminiProvider(this.keyPool);
    }

    if (mode === 'PRODUCTION') {
      throw new Error('NO_GEMINI_KEY_AVAILABLE: Production mode requires an active Gemini API key');
    }

    return this.mockProvider;
  }
}
