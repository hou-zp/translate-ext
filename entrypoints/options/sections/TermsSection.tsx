import { useState } from 'react';
import { Button, Card, Input, useToast } from '../../../src/components/ui';
import type { TermEntry } from '../../../src/core/config';
import { t } from '../../../src/core/i18n';
import { parseTermsCsv, termsToCsv } from '../../../src/core/terms';
import { downloadFile, type PanelProps } from '../shared';

export function TermsSection({ config, update }: PanelProps) {
  const toast = useToast();
  const [src, setSrc] = useState('');
  const [tgt, setTgt] = useState('');

  const add = () => {
    const source = src.trim();
    const target = tgt.trim();
    if (!source || !target) return;
    if (config.terms.some((x) => x.source === source)) {
      toast(t('该术语已存在'), 'error');
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
        toast(t('未解析到有效术语（格式：原文,译文 每行一条）'), 'error');
        return;
      }
      const merged = new Map<string, TermEntry>();
      for (const x of [...config.terms, ...parsed]) merged.set(x.source, x);
      update({ terms: [...merged.values()] });
      toast(`${t('已导入')} ${parsed.length} ${t('条术语')}`, 'success');
    });
  };

  return (
    <Card
      title={t('术语库')}
      desc={t(
        '命中术语的段落翻译时强制使用指定译法。AI 服务通过提示词注入；Google / DeepL / 微软通过占位符锁定实现。',
      )}
    >
      <div className="mb-3 flex gap-2">
        <Input
          value={src}
          placeholder={t('原文术语，如 Transformer')}
          onChange={(e) => setSrc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Input
          value={tgt}
          placeholder={t('固定译法，如 Transformer 模型')}
          onChange={(e) => setTgt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button variant="primary" className="shrink-0" onClick={add}>
          {t('添加')}
        </Button>
      </div>
      <div className="max-h-96 space-y-1 overflow-y-auto">
        {config.terms.map((term) => (
          <div
            key={term.source}
            className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate text-ink">{term.source}</span>
            <span className="text-ink-3">→</span>
            <span className="min-w-0 flex-1 truncate text-ink">{term.target}</span>
            <label className="flex shrink-0 items-center gap-1 text-xs text-ink-3">
              <input
                type="checkbox"
                checked={!!term.caseSensitive}
                onChange={(e) =>
                  update({
                    terms: config.terms.map((x) =>
                      x.source === term.source ? { ...x, caseSensitive: e.target.checked } : x,
                    ),
                  })
                }
              />
              {t('区分大小写')}
            </label>
            <button
              type="button"
              className="shrink-0 text-xs text-danger hover:underline"
              onClick={() =>
                update({ terms: config.terms.filter((x) => x.source !== term.source) })
              }
            >
              {t('删除')}
            </button>
          </div>
        ))}
        {config.terms.length === 0 && <p className="text-sm text-ink-3">{t('还没有术语')}</p>}
      </div>
      <div className="mt-4 flex gap-3">
        <label className="cursor-pointer rounded-lg border border-line bg-card px-4 py-1.5 text-sm text-ink-2 transition-colors hover:bg-fill">
          {t('导入 CSV')}
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
        <Button
          size="sm"
          className="!px-4 !py-1.5 !text-sm"
          disabled={config.terms.length === 0}
          onClick={() => downloadFile('glossary.csv', termsToCsv(config.terms), 'text/csv')}
        >
          {t('导出 CSV')}
        </Button>
        {config.terms.length > 0 && (
          <Button variant="danger" size="sm" className="!px-4 !py-1.5 !text-sm" onClick={() => update({ terms: [] })}>
            {t('清空')}
          </Button>
        )}
      </div>
    </Card>
  );
}
