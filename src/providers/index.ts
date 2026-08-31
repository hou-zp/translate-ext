import type { ProviderId } from '../core/config';
import type { Provider } from './base';
import { baiduProvider } from './baidu';
import { caiyunProvider } from './caiyun';
import { claudeProvider } from './claude';
import { deeplProvider } from './deepl';
import { geminiProvider } from './gemini';
import { googleProvider } from './google';
import { microsoftProvider } from './microsoft';
import { ollamaProvider } from './ollama';
import { openaiProvider } from './openai';
import { tencentProvider } from './tencent';

export const PROVIDERS: Record<ProviderId, Provider> = {
  google: googleProvider,
  deepl: deeplProvider,
  microsoft: microsoftProvider,
  tencent: tencentProvider,
  baidu: baiduProvider,
  caiyun: caiyunProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  claude: claudeProvider,
  ollama: ollamaProvider,
};

export const PROVIDER_LIST: Provider[] = Object.values(PROVIDERS);

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS[id] ?? googleProvider;
}
