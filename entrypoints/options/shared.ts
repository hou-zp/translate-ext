import type { AppConfig, TranslationStyle } from '../../src/core/config';
import { t } from '../../src/core/i18n';

export interface PanelProps {
  config: AppConfig;
  update: (patch: Partial<AppConfig>) => void;
}

export const STYLE_OPTIONS: { value: TranslationStyle; label: string }[] = [
  { value: 'plain', label: t('无样式') },
  { value: 'underline', label: t('实线下划线') },
  { value: 'dashed', label: t('虚线下划线') },
  { value: 'quote', label: t('引用竖线') },
  { value: 'highlight', label: t('高亮背景') },
];

export function downloadFile(name: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob(['\ufeff' + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
