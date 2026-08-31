import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Select, Toggle, useToast } from '../../src/components/ui';
import { useConfig } from '../../src/components/useConfig';
import {
  replaceConfig,
  type AppConfig,
  type ExpertDef,
  type HoverModifier,
  type ProviderId,
  type ProviderSettings,
  type SiteRule,
  type TermEntry,
} from '../../src/core/config';
import {
  clearFavorites,
  favoritesToAnkiCsv,
  listFavorites,
  removeFavorite,
  type FavoriteEntry,
} from '../../src/core/favorites';
import { LANGS, langLabel } from '../../src/core/langs';
import { sendToBackground, type ProviderTestRes } from '../../src/core/messaging';
import { BUILTIN_EXPERTS } from '../../src/core/prompts';
import { applyBackup, webdavDownload, webdavUpload } from '../../src/core/sync';
import { parseTermsCsv, termsToCsv } from '../../src/core/terms';
import { PROVIDER_LIST } from '../../src/providers';

type Section =
  | 'general'
  | 'providers'
  | 'experts'
  | 'terms'
  | 'favorites'
  | 'shortcuts'
  | 'sites'
  | 'data';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'providers', label: '翻译服务' },
  { id: 'experts', label: 'AI 专家' },
  { id: 'terms', label: '术语库' },
  { id: 'favorites', label: '生词本' },
  { id: 'shortcuts', label: '快捷键' },
  { id: 'sites', label: '站点规则' },
  { id: 'data', label: '缓存与数据' },
];

const STYLE_OPTIONS = [
  { value: 'plain', label: '无样式' },
  { value: 'underline', label: '实线下划线' },
  { value: 'dashed', label: '虚线下划线' },
  { value: 'quote', label: '引用竖线' },
  { value: 'highlight', label: '高亮背景' },
];

function Card(props: { title: string; children: React.ReactNode; desc?: string }) {
  return (
    <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-[15px] font-semibold text-gray-800">{props.title}</h3>
      {props.desc && <p className="mb-3 text-xs leading-5 text-gray-400">{props.desc}</p>}
      <div className="mt-3">{props.children}</div>
    </section>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs text-gray-500">{props.label}</span>
      {props.children}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

// ---------------------------------------------------------------------------

function GeneralPanel({ config, update }: PanelProps) {
  const styleClassMap: Record<string, React.CSSProperties> = {
    plain: {},
    underline: { borderBottom: '1px solid rgba(59,130,246,.55)', width: 'fit-content' },
    dashed: { borderBottom: '1px dashed rgba(59,130,246,.7)', width: 'fit-content' },
    quote: { borderLeft: '3px solid rgba(59,130,246,.6)', paddingLeft: 8 },
    highlight: { background: 'rgba(59,130,246,.1)', borderRadius: 3, width: 'fit-content' },
  };
  return (
    <>
      <Card title="默认语言">
        <div className="grid grid-cols-2 gap-4">
          <Field label="源语言">
            <span className="block rounded-lg border border-gray-200 px-3 py-2">
              <Select
                className="w-full"
                value={config.sourceLang}
                onChange={(v) => update({ sourceLang: v })}
                options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
              />
            </span>
          </Field>
          <Field label="目标语言">
            <span className="block rounded-lg border border-gray-200 px-3 py-2">
              <Select
                className="w-full"
                value={config.targetLang}
                onChange={(v) => update({ targetLang: v })}
                options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
                  value: l.code,
                  label: l.label,
                }))}
              />
            </span>
          </Field>
        </div>
      </Card>

      <Card title="译文显示" desc="双语对照会把译文插在原文下方；替换模式直接用译文替换原文，可随时还原。">
        <div className="mb-4 flex gap-3">
          {(
            [
              ['bilingual', '双语对照'],
              ['replace', '替换原文'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ displayMode: v })}
              className={`rounded-lg border px-4 py-2 text-sm ${
                config.displayMode === v
                  ? 'border-brand bg-blue-50 text-brand'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="译文样式">
          <span className="block w-56 rounded-lg border border-gray-200 px-3 py-2">
            <Select
              className="w-full"
              value={config.translationStyle}
              onChange={(v) => update({ translationStyle: v as AppConfig['translationStyle'] })}
              options={STYLE_OPTIONS}
            />
          </span>
        </Field>
        <div className="rounded-xl bg-gray-50 p-4 text-sm leading-7">
          <p className="text-gray-800">The quick brown fox jumps over the lazy dog.</p>
          <p className="mt-1 text-gray-800" style={styleClassMap[config.translationStyle]}>
            敏捷的棕色狐狸跳过了那只懒狗。
          </p>
        </div>
      </Card>

      <Card title="交互功能">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-800">划词翻译</div>
              <div className="text-xs text-gray-400">选中文字后显示翻译按钮</div>
            </div>
            <Toggle
              checked={config.selectionEnabled}
              onChange={(v) => update({ selectionEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-800">鼠标悬停翻译</div>
              <div className="text-xs text-gray-400">悬停段落时就地翻译该段</div>
            </div>
            <Toggle checked={config.hoverEnabled} onChange={(v) => update({ hoverEnabled: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-800">悬停触发条件</div>
            <span className="rounded-lg border border-gray-200 px-3 py-1.5">
              <Select
                value={config.hoverModifier}
                onChange={(v) => update({ hoverModifier: v as HoverModifier })}
                options={[
                  { value: 'shift', label: '按住 Shift 悬停' },
                  { value: 'alt', label: '按住 Alt / Option 悬停' },
                  { value: 'ctrl', label: '按住 Ctrl / Cmd 悬停' },
                  { value: 'none', label: '直接悬停（无需按键）' },
                ]}
              />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-800">页面悬浮球</div>
              <div className="text-xs text-gray-400">在网页右侧显示快捷翻译入口</div>
            </div>
            <Toggle
              checked={config.floatButtonEnabled}
              onChange={(v) => update({ floatButtonEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-800">输入框翻译</div>
              <div className="text-xs text-gray-400">
                在任意输入框中输入母语后快速按 3 次空格，原地替换为目标语言
              </div>
            </div>
            <Toggle
              checked={config.inputTranslateEnabled}
              onChange={(v) => update({ inputTranslateEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-800">输入框翻译目标语言</div>
            <span className="rounded-lg border border-gray-200 px-3 py-1.5">
              <Select
                value={config.inputTranslateLang}
                onChange={(v) => update({ inputTranslateLang: v })}
                options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
                  value: l.code,
                  label: l.label,
                }))}
              />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-800">YouTube 双语字幕</div>
              <div className="text-xs text-gray-400">
                在 YouTube 播放器上叠加翻译字幕（需要视频本身带字幕轨）
              </div>
            </div>
            <Toggle
              checked={config.youtubeSubtitlesEnabled}
              onChange={(v) => update({ youtubeSubtitlesEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-800">视频网站双语字幕（Beta）</div>
              <div className="text-xs text-gray-400">
                Netflix / B 站 / Coursera / Udemy / Prime Video / Disney+ / Vimeo，跟随播放器原生字幕实时翻译
              </div>
            </div>
            <Toggle
              checked={config.videoSubtitlesEnabled}
              onChange={(v) => update({ videoSubtitlesEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-800">会议实时字幕翻译（Beta）</div>
              <div className="text-xs text-gray-400">
                Google Meet / Zoom 网页版 / Teams，需先在会议中开启平台自带的实时字幕（CC）
              </div>
            </div>
            <Toggle
              checked={config.meetingCaptionsEnabled}
              onChange={(v) => update({ meetingCaptionsEnabled: v })}
            />
          </div>
        </div>
      </Card>

      <Card title="AI 精翻" desc="开启后先用当前服务快速翻译，再交给 AI 模型按所选专家风格润色替换。">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-800">默认启用 AI 精翻</div>
          <Toggle checked={config.refineEnabled} onChange={(v) => update({ refineEnabled: v })} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-800">AI 上下文翻译</div>
            <div className="text-xs text-gray-400">
              整页翻译前先让 AI 总结全文并提取术语，注入每批段落的提示词，减少代词与多义词误译（每页多一次模型调用）
            </div>
          </div>
          <Toggle checked={config.contextEnabled} onChange={(v) => update({ contextEnabled: v })} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-800">精翻使用的模型服务（当主服务不是 AI 时）</div>
          <span className="rounded-lg border border-gray-200 px-3 py-1.5">
            <Select
              value={config.refineProvider}
              onChange={(v) => update({ refineProvider: v as 'openai' | 'ollama' })}
              options={[
                { value: 'ollama', label: 'Ollama（本地）' },
                { value: 'openai', label: 'OpenAI 兼容' },
              ]}
            />
          </span>
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

const PROVIDER_FIELDS: Record<
  ProviderId,
  { key: keyof ProviderSettings; label: string; placeholder?: string; password?: boolean }[]
> = {
  google: [],
  deepl: [{ key: 'apiKey', label: 'API Key（免费版 Key 以 :fx 结尾）', password: true }],
  microsoft: [
    { key: 'apiKey', label: 'Azure 翻译资源 Key', password: true },
    { key: 'region', label: '区域（如 eastasia，全球资源可留空）', placeholder: 'eastasia' },
  ],
  openai: [
    { key: 'baseUrl', label: 'API 地址（兼容 OpenAI 协议的网关均可）', placeholder: 'https://api.openai.com/v1' },
    { key: 'apiKey', label: 'API Key', password: true },
    { key: 'model', label: '模型', placeholder: 'gpt-4o-mini' },
  ],
  ollama: [
    { key: 'baseUrl', label: '服务地址', placeholder: 'http://127.0.0.1:11434' },
    { key: 'model', label: '模型', placeholder: 'qwen2.5:7b' },
  ],
};

function ProvidersPanel({ config, update }: PanelProps) {
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
        return (
          <Card
            key={p.id}
            title={p.name}
            desc={
              p.id === 'google'
                ? '使用免费网页端接口，无需配置，开箱即用。'
                : p.id === 'ollama'
                  ? '本地大模型翻译，数据不出本机。需要先安装 Ollama 并设置环境变量 OLLAMA_ORIGINS="*"（或包含本扩展来源），然后重启 Ollama。'
                  : undefined
            }
          >
            {fields.map((f) => (
              <Field key={String(f.key)} label={f.label}>
                <input
                  className={inputCls}
                  type={f.password ? 'password' : 'text'}
                  placeholder={f.placeholder}
                  value={(config.providers[p.id]?.[f.key] as string | undefined) ?? ''}
                  onChange={(e) => setField(p.id, f.key, e.target.value)}
                />
              </Field>
            ))}
            {res?.models && res.models.length > 0 && (p.id === 'ollama' || p.id === 'openai') && (
              <Field label="从可用模型中选择">
                <span className="block w-72 rounded-lg border border-gray-200 px-3 py-2">
                  <Select
                    className="w-full"
                    value={config.providers[p.id]?.model ?? ''}
                    onChange={(v) => setField(p.id, 'model', v)}
                    options={res.models.map((m) => ({ value: m, label: m }))}
                  />
                </span>
              </Field>
            )}
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={testing === p.id}
                onClick={() => test(p.id)}
                className="rounded-lg bg-brand px-4 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {testing === p.id ? '测试中…' : '测试连接'}
              </button>
              {res && (
                <span className={`text-xs ${res.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                  {res.ok ? '✓ ' : '✕ '}
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

// ---------------------------------------------------------------------------

function ExpertsPanel({ config, update }: PanelProps) {
  const [editing, setEditing] = useState<ExpertDef | null>(null);
  const toast = useToast();

  const saveExpert = () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.prompt.trim()) {
      toast('名称和提示词不能为空', 'error');
      return;
    }
    const exists = config.customExperts.some((e) => e.id === editing.id);
    update({
      customExperts: exists
        ? config.customExperts.map((e) => (e.id === editing.id ? editing : e))
        : [...config.customExperts, editing],
    });
    setEditing(null);
  };

  return (
    <>
      <Card
        title="内置专家"
        desc="AI 专家决定 AI 翻译/精翻使用的系统提示词。{{from}} 和 {{to}} 会被替换为源语言和目标语言。"
      >
        <div className="space-y-2">
          {BUILTIN_EXPERTS.map((e) => (
            <details key={e.id} className="rounded-lg border border-gray-100 px-3 py-2">
              <summary className="cursor-pointer text-sm text-gray-800">{e.name}</summary>
              <p className="mt-2 text-xs leading-5 text-gray-500">{e.prompt}</p>
            </details>
          ))}
        </div>
      </Card>

      <Card title="自定义专家">
        <div className="space-y-2">
          {config.customExperts.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
            >
              <span className="text-sm text-gray-800">{e.name}</span>
              <span className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="text-brand hover:underline"
                  onClick={() => setEditing({ ...e })}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="text-red-500 hover:underline"
                  onClick={() =>
                    update({
                      customExperts: config.customExperts.filter((x) => x.id !== e.id),
                      ...(config.expertId === e.id ? { expertId: 'general' } : {}),
                    })
                  }
                >
                  删除
                </button>
              </span>
            </div>
          ))}
          {config.customExperts.length === 0 && (
            <p className="text-sm text-gray-400">还没有自定义专家</p>
          )}
        </div>
        <button
          type="button"
          className="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-brand hover:text-brand"
          onClick={() =>
            setEditing({
              id: `custom-${Date.now()}`,
              name: '',
              prompt:
                'You are a professional translator. Translate the given text from {{from}} to {{to}}. Output the translation only.',
            })
          }
        >
          + 新建专家
        </button>

        {editing && (
          <div className="mt-4 rounded-xl border border-brand/30 bg-blue-50/40 p-4">
            <Field label="专家名称">
              <input
                className={inputCls}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="例如：游戏本地化"
              />
            </Field>
            <Field label="系统提示词（英文效果最佳，支持 {{from}} / {{to}} 占位符）">
              <textarea
                className={`${inputCls} h-32 resize-y font-mono text-xs leading-5`}
                value={editing.prompt}
                onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
              />
            </Field>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveExpert}
                className="rounded-lg bg-brand px-4 py-1.5 text-sm text-white hover:bg-brand-dark"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

function downloadFile(name: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob(['\ufeff' + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function TermsPanel({ config, update }: PanelProps) {
  const toast = useToast();
  const [src, setSrc] = useState('');
  const [tgt, setTgt] = useState('');

  const add = () => {
    const source = src.trim();
    const target = tgt.trim();
    if (!source || !target) return;
    if (config.terms.some((t) => t.source === source)) {
      toast('该术语已存在', 'error');
      return;
    }
    update({ terms: [...config.terms, { source, target }] });
    setSrc('');
    setTgt('');
  };

  const importCsv = (file: File) => {
    void file.text().then((text) => {
      const parsed = parseTermsCsv(text);
      if (parsed.length === 0) {
        toast('未解析到有效术语（格式：原文,译文 每行一条）', 'error');
        return;
      }
      const merged = new Map<string, TermEntry>();
      for (const t of [...config.terms, ...parsed]) merged.set(t.source, t);
      update({ terms: [...merged.values()] });
      toast(`已导入 ${parsed.length} 条术语`, 'success');
    });
  };

  return (
    <>
      <Card
        title="术语库"
        desc="命中术语的段落翻译时强制使用指定译法。AI 服务通过提示词注入；Google / DeepL / 微软通过占位符锁定实现。"
      >
        <div className="mb-3 flex gap-2">
          <input
            className={inputCls}
            value={src}
            placeholder="原文术语，如 Transformer"
            onChange={(e) => setSrc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <input
            className={inputCls}
            value={tgt}
            placeholder="固定译法，如 Transformer 模型"
            onChange={(e) => setTgt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button
            type="button"
            onClick={add}
            className="shrink-0 rounded-lg bg-brand px-4 text-sm text-white hover:bg-brand-dark"
          >
            添加
          </button>
        </div>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {config.terms.map((term) => (
            <div
              key={term.source}
              className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-gray-800">{term.source}</span>
              <span className="text-gray-300">→</span>
              <span className="min-w-0 flex-1 truncate text-gray-800">{term.target}</span>
              <label className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={!!term.caseSensitive}
                  onChange={(e) =>
                    update({
                      terms: config.terms.map((t) =>
                        t.source === term.source ? { ...t, caseSensitive: e.target.checked } : t,
                      ),
                    })
                  }
                />
                区分大小写
              </label>
              <button
                type="button"
                className="shrink-0 text-xs text-red-500 hover:underline"
                onClick={() => update({ terms: config.terms.filter((t) => t.source !== term.source) })}
              >
                删除
              </button>
            </div>
          ))}
          {config.terms.length === 0 && <p className="text-sm text-gray-400">还没有术语</p>}
        </div>
        <div className="mt-4 flex gap-3">
          <label className="cursor-pointer rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            导入 CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
                e.target.value = '';
              }}
            />
          </label>
          <button
            type="button"
            disabled={config.terms.length === 0}
            onClick={() => downloadFile('glossary.csv', termsToCsv(config.terms), 'text/csv')}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            导出 CSV
          </button>
          {config.terms.length > 0 && (
            <button
              type="button"
              onClick={() => update({ terms: [] })}
              className="rounded-lg border border-red-200 px-4 py-1.5 text-sm text-red-500 hover:bg-red-50"
            >
              清空
            </button>
          )}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

function FavoritesPanel() {
  const toast = useToast();
  const [list, setList] = useState<FavoriteEntry[]>([]);

  const refresh = () => {
    void listFavorites().then(setList);
  };
  useEffect(refresh, []);

  return (
    <Card
      title="生词本"
      desc="划词翻译气泡中点击「收藏」即可加入生词本。可导出为 Anki 可导入的 CSV（正面=原文，背面=译文，标签=来源站点）。"
    >
      <div className="mb-4 flex gap-3">
        <button
          type="button"
          disabled={list.length === 0}
          onClick={() => {
            downloadFile('vocabulary-anki.csv', favoritesToAnkiCsv(list), 'text/csv');
            toast('已导出，可在 Anki 中通过「文件 → 导入」导入', 'success');
          }}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-40"
        >
          导出 Anki CSV
        </button>
        {list.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              await clearFavorites();
              refresh();
              toast('生词本已清空', 'success');
            }}
            className="rounded-lg border border-red-200 px-4 py-1.5 text-sm text-red-500 hover:bg-red-50"
          >
            清空
          </button>
        )}
      </div>
      <div className="max-h-[560px] space-y-2 overflow-y-auto">
        {list.map((f) => (
          <div key={f.id} className="rounded-lg border border-gray-100 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800">{f.text}</div>
                <div className="mt-0.5 text-sm text-gray-600">{f.translation}</div>
                <div className="mt-1 text-xs text-gray-400">
                  {f.host} · {langLabel(f.targetLang)} · {new Date(f.at).toLocaleDateString()}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs text-red-500 hover:underline"
                onClick={async () => {
                  await removeFavorite(f.id);
                  refresh();
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-gray-400">还没有收藏的生词</p>}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ShortcutsPanel() {
  const [commands, setCommands] = useState<{ name?: string; description?: string; shortcut?: string }[]>([]);

  useEffect(() => {
    void browser.commands?.getAll().then(setCommands);
  }, []);

  return (
    <Card title="键盘快捷键" desc="快捷键需要在浏览器的扩展快捷键页面中修改。">
      <div className="space-y-2">
        {commands.map((c) => (
          <div
            key={c.name}
            className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
          >
            <span className="text-sm text-gray-800">{c.description || c.name}</span>
            <kbd className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {c.shortcut || '未设置'}
            </kbd>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 rounded-lg bg-brand px-4 py-1.5 text-sm text-white hover:bg-brand-dark"
        onClick={() => void sendToBackground('openPage', { page: 'shortcuts' })}
      >
        打开浏览器快捷键设置
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function SiteListEditor(props: {
  title: string;
  desc: string;
  list: string[];
  onChange: (list: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const host = (input.trim().replace(/^https?:\/\//, '').split('/')[0] ?? '').toLowerCase();
    if (!host) return;
    if (!props.list.includes(host)) props.onChange([...props.list, host]);
    setInput('');
  };
  return (
    <Card title={props.title} desc={props.desc}>
      <div className="mb-3 flex gap-2">
        <input
          className={inputCls}
          value={input}
          placeholder="example.com"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-lg bg-brand px-4 text-sm text-white hover:bg-brand-dark"
        >
          添加
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {props.list.map((host) => (
          <span
            key={host}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
          >
            {host}
            <button
              type="button"
              className="text-gray-400 hover:text-red-500"
              onClick={() => props.onChange(props.list.filter((h) => h !== host))}
            >
              ✕
            </button>
          </span>
        ))}
        {props.list.length === 0 && <span className="text-sm text-gray-400">暂无站点</span>}
      </div>
    </Card>
  );
}

const EMPTY_RULE: SiteRule = { pattern: '' };

function SiteRuleEditor(props: {
  rule: SiteRule;
  onSave: (rule: SiteRule) => void;
  onCancel: () => void;
}) {
  const [rule, setRule] = useState<SiteRule>(props.rule);
  const set = (patch: Partial<SiteRule>) => setRule((r) => ({ ...r, ...patch }));
  return (
    <div className="mt-3 rounded-xl border border-brand/30 bg-blue-50/40 p-4">
      <Field label="站点（hostname，自动匹配子域名）">
        <input
          className={inputCls}
          value={rule.pattern}
          placeholder="example.com"
          onChange={(e) => set({ pattern: e.target.value.trim().toLowerCase() })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="排除选择器（这些元素不翻译，可选）">
          <input
            className={inputCls}
            value={rule.excludeSelector ?? ''}
            placeholder=".sidebar, nav, #comments"
            onChange={(e) => set({ excludeSelector: e.target.value || undefined })}
          />
        </Field>
        <Field label="仅翻译选择器（留空为整页，可选）">
          <input
            className={inputCls}
            value={rule.includeSelector ?? ''}
            placeholder="article, .main-content"
            onChange={(e) => set({ includeSelector: e.target.value || undefined })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="显示模式覆盖">
          <span className="block rounded-lg border border-gray-200 bg-white px-3 py-2">
            <Select
              className="w-full"
              value={rule.displayMode ?? ''}
              onChange={(v) => set({ displayMode: (v || undefined) as SiteRule['displayMode'] })}
              options={[
                { value: '', label: '跟随全局设置' },
                { value: 'bilingual', label: '双语对照' },
                { value: 'replace', label: '替换原文' },
              ]}
            />
          </span>
        </Field>
        <Field label="译文样式覆盖">
          <span className="block rounded-lg border border-gray-200 bg-white px-3 py-2">
            <Select
              className="w-full"
              value={rule.translationStyle ?? ''}
              onChange={(v) =>
                set({ translationStyle: (v || undefined) as SiteRule['translationStyle'] })
              }
              options={[{ value: '', label: '跟随全局设置' }, ...STYLE_OPTIONS]}
            />
          </span>
        </Field>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!rule.pattern}
          onClick={() => props.onSave(rule)}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-40"
        >
          保存
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function ruleSummary(rule: SiteRule): string {
  const parts: string[] = [];
  if (rule.includeSelector) parts.push(`仅 ${rule.includeSelector}`);
  if (rule.excludeSelector) parts.push(`排除 ${rule.excludeSelector}`);
  if (rule.displayMode) parts.push(rule.displayMode === 'replace' ? '替换原文' : '双语对照');
  if (rule.translationStyle) parts.push(`样式 ${rule.translationStyle}`);
  return parts.join(' · ') || '无附加设置';
}

function SitesPanel({ config, update }: PanelProps) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ rule: SiteRule; index: number } | null>(null);
  const [subUrl, setSubUrl] = useState(config.ruleSubscribeUrl);
  const [fetching, setFetching] = useState(false);

  const saveRule = (rule: SiteRule) => {
    if (!editing) return;
    const rules = [...config.siteRules];
    if (editing.index === -1) rules.push(rule);
    else rules[editing.index] = rule;
    update({ siteRules: rules });
    setEditing(null);
  };

  const refreshSubscription = async () => {
    const url = subUrl.trim();
    if (!url) {
      update({ ruleSubscribeUrl: '', subscribedRules: [] });
      toast('已清除订阅', 'success');
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error('JSON 顶层必须是规则数组');
      const rules = (data as SiteRule[]).filter(
        (r) => r && typeof r.pattern === 'string' && r.pattern.length > 0,
      );
      update({ ruleSubscribeUrl: url, subscribedRules: rules });
      toast(`订阅成功，获取 ${rules.length} 条规则`, 'success');
    } catch (err) {
      toast(`订阅失败：${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <SiteListEditor
        title="总是翻译的站点"
        desc="打开这些站点时自动翻译整页。"
        list={config.autoTranslateSites}
        onChange={(list) => update({ autoTranslateSites: list })}
      />
      <SiteListEditor
        title="永不翻译的站点"
        desc="这些站点不显示悬浮球，也不会自动翻译。"
        list={config.neverTranslateSites}
        onChange={(list) => update({ neverTranslateSites: list })}
      />

      <Card
        title="高级站点规则"
        desc="针对单个站点精细控制翻译范围（CSS 选择器）与显示方式，解决复杂网站误翻译导航、代码块等问题。"
      >
        <div className="space-y-2">
          {config.siteRules.map((rule, i) => (
            <div
              key={`${rule.pattern}-${i}`}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-gray-800">{rule.pattern}</div>
                <div className="truncate text-xs text-gray-400">{ruleSummary(rule)}</div>
              </div>
              <span className="flex shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  className="text-brand hover:underline"
                  onClick={() => setEditing({ rule: { ...rule }, index: i })}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="text-red-500 hover:underline"
                  onClick={() => update({ siteRules: config.siteRules.filter((_, j) => j !== i) })}
                >
                  删除
                </button>
              </span>
            </div>
          ))}
          {config.siteRules.length === 0 && (
            <p className="text-sm text-gray-400">还没有高级规则</p>
          )}
        </div>
        <button
          type="button"
          className="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-brand hover:text-brand"
          onClick={() => setEditing({ rule: { ...EMPTY_RULE }, index: -1 })}
        >
          + 新建规则
        </button>
        {editing && (
          <SiteRuleEditor
            rule={editing.rule}
            onSave={saveRule}
            onCancel={() => setEditing(null)}
          />
        )}
      </Card>

      <Card
        title="规则订阅"
        desc="从远程 URL 订阅社区维护的站点规则（JSON 数组，字段同高级规则）。本地规则优先于订阅规则。"
      >
        <div className="mb-3 flex gap-2">
          <input
            className={inputCls}
            value={subUrl}
            placeholder="https://example.com/site-rules.json"
            onChange={(e) => setSubUrl(e.target.value)}
          />
          <button
            type="button"
            disabled={fetching}
            onClick={() => void refreshSubscription()}
            className="shrink-0 rounded-lg bg-brand px-4 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {fetching ? '获取中…' : subUrl.trim() ? '订阅 / 刷新' : '清除'}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          当前已订阅 {config.subscribedRules.length} 条规则
          {config.ruleSubscribeUrl ? `（来自 ${config.ruleSubscribeUrl}）` : ''}
        </p>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

function DataPanel({ config, update }: PanelProps) {
  const toast = useToast();
  const [stats, setStats] = useState<{ entries: number; chars: number } | null>(null);
  const [davBusy, setDavBusy] = useState<'up' | 'down' | null>(null);

  const refreshStats = () => {
    void sendToBackground('getCacheStats', undefined).then(setStats);
  };
  useEffect(refreshStats, []);

  const davUpload = async () => {
    setDavBusy('up');
    try {
      await webdavUpload(config);
      toast('已上传到云端', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setDavBusy(null);
    }
  };

  const davDownload = async () => {
    setDavBusy('down');
    try {
      const backup = await webdavDownload(config);
      await applyBackup(backup);
      toast(`已恢复 ${new Date(backup.exportedAt).toLocaleString()} 的备份`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setDavBusy(null);
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translate-ext-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (file: File) => {
    void file.text().then(async (text) => {
      try {
        const cfg = JSON.parse(text) as AppConfig;
        await replaceConfig(cfg);
        toast('配置已导入', 'success');
      } catch {
        toast('配置文件格式错误', 'error');
      }
    });
  };

  return (
    <>
      <Card title="译文缓存" desc="相同段落的译文会被缓存，避免重复请求。">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-gray-800">启用缓存</span>
          <Toggle checked={config.cacheEnabled} onChange={(v) => update({ cacheEnabled: v })} />
        </div>
        <p className="mb-3 text-sm text-gray-500">
          当前缓存 {stats?.entries ?? '…'} 条译文，约 {((stats?.chars ?? 0) / 1024).toFixed(1)} KB
        </p>
        <button
          type="button"
          className="rounded-lg border border-red-200 px-4 py-1.5 text-sm text-red-500 hover:bg-red-50"
          onClick={async () => {
            await sendToBackground('clearCache', undefined);
            refreshStats();
            toast('缓存已清空', 'success');
          }}
        >
          清空缓存
        </button>
      </Card>

      <Card
        title="云同步"
        desc="浏览器同步：配置自动跟随浏览器账号在多设备间同步（含 API Key）。WebDAV：手动把完整配置 + 生词本备份到坚果云等网盘。"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-800">通过浏览器账号自动同步配置</span>
          <Toggle checked={config.syncEnabled} onChange={(v) => update({ syncEnabled: v })} />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Field label="WebDAV 地址（如 https://dav.jianguoyun.com/dav/translate-ext/）">
            <input
              className={inputCls}
              value={config.webdavUrl}
              placeholder="https://dav.example.com/translate-ext/"
              onChange={(e) => update({ webdavUrl: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="账号">
              <input
                className={inputCls}
                value={config.webdavUser}
                onChange={(e) => update({ webdavUser: e.target.value })}
              />
            </Field>
            <Field label="密码 / 应用密码">
              <input
                className={inputCls}
                type="password"
                value={config.webdavPass}
                onChange={(e) => update({ webdavPass: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="mt-1 flex gap-3">
          <button
            type="button"
            disabled={davBusy !== null}
            onClick={() => void davUpload()}
            className="rounded-lg bg-brand px-4 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {davBusy === 'up' ? '上传中…' : '上传到云端'}
          </button>
          <button
            type="button"
            disabled={davBusy !== null}
            onClick={() => void davDownload()}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {davBusy === 'down' ? '恢复中…' : '从云端恢复'}
          </button>
        </div>
      </Card>

      <Card title="配置导入导出" desc="导出的 JSON 包含 API Key，请妥善保管。">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={exportConfig}
            className="rounded-lg bg-brand px-4 py-1.5 text-sm text-white hover:bg-brand-dark"
          >
            导出配置
          </button>
          <label className="cursor-pointer rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            导入配置
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importConfig(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

interface PanelProps {
  config: AppConfig;
  update: (patch: Partial<AppConfig>) => void;
}

export default function App() {
  const { config, update } = useConfig();
  const [section, setSection] = useState<Section>(
    (location.hash.replace('#', '') as Section) || 'general',
  );

  if (!config) return null;

  const panelProps: PanelProps = { config, update };

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl gap-8 px-6 py-10">
      <aside className="w-40 shrink-0">
        <h1 className="mb-6 text-lg font-bold text-gray-800">AI 沉浸翻译</h1>
        <nav className="space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSection(s.id);
                location.hash = s.id;
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                section === s.id
                  ? 'bg-brand/10 font-medium text-brand'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        {section === 'general' && <GeneralPanel {...panelProps} />}
        {section === 'providers' && <ProvidersPanel {...panelProps} />}
        {section === 'experts' && <ExpertsPanel {...panelProps} />}
        {section === 'terms' && <TermsPanel {...panelProps} />}
        {section === 'favorites' && <FavoritesPanel />}
        {section === 'shortcuts' && <ShortcutsPanel />}
        {section === 'sites' && <SitesPanel {...panelProps} />}
        {section === 'data' && <DataPanel {...panelProps} />}
      </main>
    </div>
  );
}
