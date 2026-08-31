import type { ProviderId } from '../core/config';
import type { Provider } from './base';
import { deeplProvider } from './deepl';
import { googleProvider } from './google';
import { microsoftProvider } from './microsoft';
import { ollamaProvider } from './ollama';
import { openaiProvider } from './openai';

export const PROVIDERS: Record<ProviderId, Provider> = {
  google: googleProvider,
  deepl: deeplProvider,
  microsoft: microsoftProvider,
  openai: openaiProvider,
  ollama: ollamaProvider,
};

export const PROVIDER_LIST: Provider[] = Object.values(PROVIDERS);

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS[id] ?? googleProvider;
}
