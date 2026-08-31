import { useState } from 'react';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { Button, Card, Field, Input, Select } from '../../../src/components/ui';
import type { ProviderId, ProviderSettings } from '../../../src/core/config';
import { t } from '../../../src/core/i18n';
import { sendToBackground, type ProviderTestRes } from '../../../src/core/messaging';
import { PROVIDER_LIST } from '../../../src/providers';
import type { PanelProps } from '../shared';

const PROVIDER_FIELDS: Record<
  ProviderId,
  { key: keyof ProviderSettings; label: string; placeholder?: string; password?: boolean }[]
> = {
  google: [],
  deepl: [{ key: 'apiKey', label: t('API Key（免费版 Key 以 :fx 结尾）'), password: true }],
  microsoft: [
    { key: 'apiKey', label: t('Azure 翻译资源 Key'), password: true },
    { key: 'region', label: t('区域（如 eastasia，全球资源可留空）'), placeholder: 'eastasia' },
  ],
  tencent: [
    { key: 'secretId', label: 'SecretId', password: true },
    { key: 'secretKey', label: 'SecretKey', password: true },
    { key: 'region', label: t('地域'), placeholder: 'ap-guangzhou' },
  ],
  baidu: [
    { key: 'appId', label: 'APP ID' },
    { key: 'apiKey', label: t('密钥'), password: true },
  ],
  caiyun: [{ key: 'apiKey', label: 'Token', password: true }],
  openai: [
    {
      key: 'baseUrl',
      label: t('API 地址（兼容 OpenAI 协议的网关均可）'),
      placeholder: 'https://api.openai.com/v1',
    },
    { key: 'apiKey', label: 'API Key', password: true },
    { key: 'model', label: t('模型'), placeholder: 'gpt-4o-mini' },
  ],
  gemini: [
    { key: 'apiKey', label: 'API Key', password: true },
    { key: 'model', label: t('模型'), placeholder: 'gemini-2.5-flash' },
  ],
  claude: [
    { key: 'apiKey', label: 'API Key', password: true },
    { key: 'model', label: t('模型'), placeholder: 'claude-sonnet-4-5' },
  ],
  ollama: [
    { key: 'baseUrl', label: t('服务地址'), placeholder: 'http://127.0.0.1:11434' },
    { key: 'model', label: t('模型'), placeholder: 'qwen2.5:7b' },
  ],
};

/** Credentials each provider needs before it can be used (empty = none). */
const REQUIRED_KEYS: Partial<Record<ProviderId, (keyof ProviderSettings)[]>> = {
  deepl: ['apiKey'],
  microsoft: ['apiKey'],
  tencent: ['secretId', 'secretKey'],
  baidu: ['appId', 'apiKey'],
  caiyun: ['apiKey'],
  openai: ['apiKey'],
  gemini: ['apiKey'],
  claude: ['apiKey'],
};

/** One-click endpoint presets for the OpenAI-compatible card. */
const OPENAI_PRESETS: { label: string; baseUrl: string; model: string }[] = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
];

export function ProvidersSection({ config, update }: PanelProps) {
  const [testing, setTesting] = useState<ProviderId | null>(null);
  const [results, setResults] = useState<Partial<Record<ProviderId, ProviderTestRes>>>({});

  const setField = (id: ProviderId, key: keyof ProviderSettings, value: string) => {
    update({
      providers: {
        ...config.providers,
        [id]: { ...config.providers[id], [key]: value || undefined },
      },
    });
  };

  const setFields = (id: ProviderId, patch: Partial<ProviderSettings>) => {
    update({
      providers: {
        ...config.providers,
        [id]: { ...config.providers[id], ...patch },
      },
    });
  };

  const test = async (id: ProviderId) => {
    setTesting(id);
    try {
      const res = await sendToBackground('testProvider', { provider: id });
      setResults((prev) => ({ ...prev, [id]: res }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [id]: { ok: false, message: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <>
      {PROVIDER_LIST.map((p) => {
        const res = results[p.id];
        const fields = PROVIDER_FIELDS[p.id];
        const configured = (REQUIRED_KEYS[p.id] ?? []).every(
          (k) => !!config.providers[p.id]?.[k],
        );
        const isCurrent = config.provider === p.id;
        return (
          <Card key={p.id}>
            <header className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">{p.name}</h2>
                {isCurrent && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                    {t('当前使用')}
                  </span>
                )}
              </div>
              <span
                className={`flex items-center gap-1 text-[11px] ${
                  configured ? 'text-success' : 'text-ink-3'
                }`}
              >
                {configured ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                {configured ? t('已配置') : t('未配置')}
              </span>
            </header>
            {p.id === 'google' && (
              <p className="mb-3 text-xs leading-relaxed text-ink-3">
                {t('使用免费网页端接口，无需配置，开箱即用。')}
              </p>
            )}
            {p.id === 'ollama' && (
              <p className="mb-3 text-xs leading-relaxed text-ink-3">
                {t(
                  '本地大模型翻译，数据不出本机。需要先安装 Ollama 并设置环境变量 OLLAMA_ORIGINS="*"（或包含本扩展来源），然后重启 Ollama。',
                )}
              </p>
            )}
            {p.id === 'openai' && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-ink-3">{t('快速预设')}</span>
                {OPENAI_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                      config.providers.openai?.baseUrl === preset.baseUrl
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-line text-ink-2 hover:bg-fill'
                    }`}
                    onClick={() =>
                      setFields('openai', { baseUrl: preset.baseUrl, model: preset.model })
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            {fields.map((f) => (
              <Field key={String(f.key)} label={f.label}>
                <Input
                  type={f.password ? 'password' : 'text'}
                  placeholder={f.placeholder}
                  value={(config.providers[p.id]?.[f.key] as string | undefined) ?? ''}
                  onChange={(e) => setField(p.id, f.key, e.target.value)}
                />
              </Field>
            ))}
            {res?.models && res.models.length > 0 && p.isAI && (
              <Field label={t('从可用模型中选择')}>
                <Select
                  variant="field"
                  className="w-72"
                  value={config.providers[p.id]?.model ?? ''}
                  onChange={(v) => setField(p.id, 'model', v)}
                  options={res.models.map((m) => ({ value: m, label: m }))}
                />
              </Field>
            )}
            <div className="mt-2 flex items-center gap-3">
              <Button variant="primary" size="sm" loading={testing === p.id} onClick={() => test(p.id)}>
                {testing === p.id ? t('测试中') + '…' : t('测试连接')}
              </Button>
              {res && (
                <span
                  className={`flex items-center gap-1 text-xs ${res.ok ? 'text-success' : 'text-danger'}`}
                >
                  {res.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {res.message}
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </>
  );
}
