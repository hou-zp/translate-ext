import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, Field, Input, Select, useToast } from '../../../src/components/ui';
import type { SiteRule } from '../../../src/core/config';
import { t } from '../../../src/core/i18n';
import { STYLE_OPTIONS, type PanelProps } from '../shared';

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
        <Input
          value={input}
          placeholder="example.com"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button variant="primary" className="shrink-0" onClick={add}>
          {t('添加')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {props.list.map((host) => (
          <span
            key={host}
            className="flex items-center gap-1 rounded-full bg-fill px-3 py-1 text-xs text-ink-2"
          >
            {host}
            <button
              type="button"
              className="text-ink-3 transition-colors hover:text-danger"
              onClick={() => props.onChange(props.list.filter((h) => h !== host))}
            >
              ✕
            </button>
          </span>
        ))}
        {props.list.length === 0 && <span className="text-sm text-ink-3">{t('暂无站点')}</span>}
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
    <div className="mt-3 rounded-xl border border-brand/30 bg-brand-soft/40 p-4 animate-collapse-in">
      <Field label={t('站点（hostname，自动匹配子域名）')}>
        <Input
          value={rule.pattern}
          placeholder="example.com"
          onChange={(e) => set({ pattern: e.target.value.trim().toLowerCase() })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('排除选择器（这些元素不翻译，可选）')}>
          <Input
            value={rule.excludeSelector ?? ''}
            placeholder=".sidebar, nav, #comments"
            onChange={(e) => set({ excludeSelector: e.target.value || undefined })}
          />
        </Field>
        <Field label={t('仅翻译选择器（留空为整页，可选）')}>
          <Input
            value={rule.includeSelector ?? ''}
            placeholder="article, .main-content"
            onChange={(e) => set({ includeSelector: e.target.value || undefined })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('显示模式覆盖')}>
          <Select
            variant="field"
            value={rule.displayMode ?? ''}
            onChange={(v) => set({ displayMode: (v || undefined) as SiteRule['displayMode'] })}
            options={[
              { value: '', label: t('跟随全局设置') },
              { value: 'bilingual', label: t('双语对照') },
              { value: 'replace', label: t('替换原文') },
            ]}
          />
        </Field>
        <Field label={t('译文样式覆盖')}>
          <Select
            variant="field"
            value={rule.translationStyle ?? ''}
            onChange={(v) =>
              set({ translationStyle: (v || undefined) as SiteRule['translationStyle'] })
            }
            options={[{ value: '', label: t('跟随全局设置') }, ...STYLE_OPTIONS]}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" disabled={!rule.pattern} onClick={() => props.onSave(rule)}>
          {t('保存')}
        </Button>
        <Button size="sm" onClick={props.onCancel}>
          {t('取消')}
        </Button>
      </div>
    </div>
  );
}

function ruleSummary(rule: SiteRule): string {
  const parts: string[] = [];
  if (rule.includeSelector) parts.push(`${t('仅')} ${rule.includeSelector}`);
  if (rule.excludeSelector) parts.push(`${t('排除')} ${rule.excludeSelector}`);
  if (rule.displayMode) parts.push(rule.displayMode === 'replace' ? t('替换原文') : t('双语对照'));
  if (rule.translationStyle) parts.push(`${t('样式')} ${rule.translationStyle}`);
  return parts.join(' · ') || t('无附加设置');
}

export function SitesSection({ config, update }: PanelProps) {
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
      toast(t('已清除订阅'), 'success');
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error(t('JSON 顶层必须是规则数组'));
      const rules = (data as SiteRule[]).filter(
        (r) => r && typeof r.pattern === 'string' && r.pattern.length > 0,
      );
      update({ ruleSubscribeUrl: url, subscribedRules: rules });
      toast(`${t('订阅成功，获取')} ${rules.length} ${t('条规则')}`, 'success');
    } catch (err) {
      toast(`${t('订阅失败')}：${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <SiteListEditor
        title={t('总是翻译的站点')}
        desc={t('打开这些站点时自动翻译整页。')}
        list={config.autoTranslateSites}
        onChange={(list) => update({ autoTranslateSites: list })}
      />
      <SiteListEditor
        title={t('永不翻译的站点')}
        desc={t('这些站点不显示悬浮球，也不会自动翻译。')}
        list={config.neverTranslateSites}
        onChange={(list) => update({ neverTranslateSites: list })}
      />

      <Card
        title={t('高级站点规则')}
        desc={t(
          '针对单个站点精细控制翻译范围（CSS 选择器）与显示方式，解决复杂网站误翻译导航、代码块等问题。',
        )}
      >
        <div className="space-y-2">
          {config.siteRules.map((rule, i) => (
            <div
              key={`${rule.pattern}-${i}`}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-ink">{rule.pattern}</div>
                <div className="truncate text-xs text-ink-3">{ruleSummary(rule)}</div>
              </div>
              <span className="flex shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  className="text-brand hover:underline"
                  onClick={() => setEditing({ rule: { ...rule }, index: i })}
                >
                  {t('编辑')}
                </button>
                <button
                  type="button"
                  className="text-danger hover:underline"
                  onClick={() => update({ siteRules: config.siteRules.filter((_, j) => j !== i) })}
                >
                  {t('删除')}
                </button>
              </span>
            </div>
          ))}
          {config.siteRules.length === 0 && (
            <p className="text-sm text-ink-3">{t('还没有高级规则')}</p>
          )}
        </div>
        <button
          type="button"
          className="mt-3 flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-2 text-sm text-ink-3 transition-colors hover:border-brand hover:text-brand"
          onClick={() => setEditing({ rule: { ...EMPTY_RULE }, index: -1 })}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('新建规则')}
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
        title={t('规则订阅')}
        desc={t(
          '从远程 URL 订阅社区维护的站点规则（JSON 数组，字段同高级规则）。本地规则优先于订阅规则。',
        )}
      >
        <div className="mb-3 flex gap-2">
          <Input
            value={subUrl}
            placeholder="https://example.com/site-rules.json"
            onChange={(e) => setSubUrl(e.target.value)}
          />
          <Button
            variant="primary"
            className="shrink-0"
            loading={fetching}
            onClick={() => void refreshSubscription()}
          >
            {fetching ? t('获取中') + '…' : subUrl.trim() ? t('订阅 / 刷新') : t('清除')}
          </Button>
        </div>
        <p className="text-xs text-ink-3">
          {t('当前已订阅')} {config.subscribedRules.length} {t('条规则')}
          {config.ruleSubscribeUrl ? `（${t('来自')} ${config.ruleSubscribeUrl}）` : ''}
        </p>
      </Card>
    </>
  );
}
