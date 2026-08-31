import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, Field, Input, Textarea, useToast } from '../../../src/components/ui';
import type { ExpertDef } from '../../../src/core/config';
import { t } from '../../../src/core/i18n';
import { BUILTIN_EXPERTS } from '../../../src/core/prompts';
import type { PanelProps } from '../shared';

export function ExpertsSection({ config, update }: PanelProps) {
  const [editing, setEditing] = useState<ExpertDef | null>(null);
  const toast = useToast();

  const saveExpert = () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.prompt.trim()) {
      toast(t('名称和提示词不能为空'), 'error');
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
        title={t('内置专家')}
        desc={t(
          'AI 专家决定 AI 翻译/精翻使用的系统提示词。{{from}} 和 {{to}} 会被替换为源语言和目标语言。',
        )}
      >
        <div className="space-y-2">
          {BUILTIN_EXPERTS.map((e) => (
            <details key={e.id} className="rounded-lg border border-line px-3 py-2">
              <summary className="cursor-pointer text-sm text-ink">{e.name}</summary>
              <p className="mt-2 text-xs leading-5 text-ink-3">{e.prompt}</p>
            </details>
          ))}
        </div>
      </Card>

      <Card title={t('自定义专家')}>
        <div className="space-y-2">
          {config.customExperts.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
            >
              <span className="text-sm text-ink">{e.name}</span>
              <span className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="text-brand hover:underline"
                  onClick={() => setEditing({ ...e })}
                >
                  {t('编辑')}
                </button>
                <button
                  type="button"
                  className="text-danger hover:underline"
                  onClick={() =>
                    update({
                      customExperts: config.customExperts.filter((x) => x.id !== e.id),
                      ...(config.expertId === e.id ? { expertId: 'general' } : {}),
                    })
                  }
                >
                  {t('删除')}
                </button>
              </span>
            </div>
          ))}
          {config.customExperts.length === 0 && (
            <p className="text-sm text-ink-3">{t('还没有自定义专家')}</p>
          )}
        </div>
        <button
          type="button"
          className="mt-3 flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-2 text-sm text-ink-3 transition-colors hover:border-brand hover:text-brand"
          onClick={() =>
            setEditing({
              id: `custom-${Date.now()}`,
              name: '',
              prompt:
                'You are a professional translator. Translate the given text from {{from}} to {{to}}. Output the translation only.',
            })
          }
        >
          <Plus className="h-3.5 w-3.5" />
          {t('新建专家')}
        </button>

        {editing && (
          <div className="mt-4 rounded-xl border border-brand/30 bg-brand-soft/40 p-4 animate-collapse-in">
            <Field label={t('专家名称')}>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder={t('例如：游戏本地化')}
              />
            </Field>
            <Field label={t('系统提示词（英文效果最佳，支持 {{from}} / {{to}} 占位符）')}>
              <Textarea
                className="h-32 !resize-y font-mono text-xs leading-5"
                value={editing.prompt}
                onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={saveExpert}>
                {t('保存')}
              </Button>
              <Button size="sm" onClick={() => setEditing(null)}>
                {t('取消')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
