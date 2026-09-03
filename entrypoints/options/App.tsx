import { useState } from 'react';
import { browser } from 'wxt/browser';
import {
  BookMarked,
  Database,
  Keyboard,
  ListChecks,
  Plug,
  Settings2,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useConfig } from '../../src/components/useConfig';
import { t } from '../../src/core/i18n';
import { DataSection } from './sections/DataSection';
import { ExpertsSection } from './sections/ExpertsSection';
import { FavoritesSection } from './sections/FavoritesSection';
import { GeneralSection } from './sections/GeneralSection';
import { ProvidersSection } from './sections/ProvidersSection';
import { ShortcutsSection } from './sections/ShortcutsSection';
import { SitesSection } from './sections/SitesSection';
import { TermsSection } from './sections/TermsSection';
import type { PanelProps } from './shared';

type Section =
  | 'general'
  | 'providers'
  | 'experts'
  | 'terms'
  | 'favorites'
  | 'shortcuts'
  | 'sites'
  | 'data';

interface SectionDef {
  id: Section;
  label: string;
  desc: string;
  icon: LucideIcon;
}

const GROUPS: { label: string; sections: SectionDef[] }[] = [
  {
    label: t('基础设置'),
    sections: [
      { id: 'general', label: t('通用'), desc: t('语言、显示模式与交互功能'), icon: Settings2 },
      { id: 'providers', label: t('翻译服务'), desc: t('配置各翻译服务的密钥与模型'), icon: Plug },
      { id: 'experts', label: t('AI 专家'), desc: t('管理 AI 翻译使用的系统提示词'), icon: Sparkles },
      { id: 'shortcuts', label: t('快捷键'), desc: t('查看与修改键盘快捷键'), icon: Keyboard },
    ],
  },
  {
    label: t('数据与规则'),
    sections: [
      { id: 'terms', label: t('术语库'), desc: t('固定专有名词的译法'), icon: BookMarked },
      { id: 'favorites', label: t('生词本'), desc: t('管理收藏的词句并导出 Anki'), icon: Star },
      { id: 'sites', label: t('站点规则'), desc: t('按站点控制翻译行为与范围'), icon: ListChecks },
      { id: 'data', label: t('缓存与数据'), desc: t('译文缓存、云同步与配置备份'), icon: Database },
    ],
  },
];

const ALL_SECTIONS = GROUPS.flatMap((g) => g.sections);

export default function App() {
  const { config, update } = useConfig();
  const [section, setSection] = useState<Section>(() => {
    const hash = location.hash.replace('#', '') as Section;
    return ALL_SECTIONS.some((s) => s.id === hash) ? hash : 'general';
  });

  if (!config) return null;

  const panelProps: PanelProps = { config, update };
  const current = ALL_SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="relative mx-auto flex min-h-screen max-w-5xl gap-10 px-6 py-10">
      <div className="grid-bg pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="noise-overlay" aria-hidden="true" />
      <aside className="relative w-52 shrink-0">
        <div className="sticky top-10">
          <div className="mb-7 flex items-center gap-2.5 px-1">
            <img src="/icon/32.png" alt="" className="h-7 w-7" />
            <span className="leading-none">
              <span className="block font-display text-[15px] font-black tracking-wide text-ink">AI 沉浸翻译</span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.22em] text-ink-3">
                options · v{browser.runtime.getManifest().version}
              </span>
            </span>
          </div>
          <nav>
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-5">
                <div className="mb-1.5 px-3 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-3">
                  {g.label}
                </div>
                <div className="space-y-0.5">
                  {g.sections.map((s) => {
                    const IconCmp = s.icon;
                    const active = section === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSection(s.id);
                          location.hash = s.id;
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12.5px] transition-all duration-150 ${
                          active
                            ? 'bg-brand-soft text-brand-hi'
                            : 'text-ink-3 hover:bg-fill/50 hover:text-ink-2'
                        }`}
                      >
                        <IconCmp className={`h-4 w-4 ${active ? '' : 'opacity-70'}`} />
                        {s.label}
                        {active && <span className="ml-auto h-1 w-1 rounded-full bg-brand-hi" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
      <main className="relative min-w-0 flex-1">
        <header className="mb-6 animate-fade-in" key={`head-${section}`}>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.26em] text-brand-hi">
            {section}
          </p>
          <h1 className="font-display text-[22px] font-bold tracking-wide text-ink">{current.label}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{current.desc}</p>
        </header>
        <div className="animate-slide-up" key={section}>
          {section === 'general' && <GeneralSection {...panelProps} />}
          {section === 'providers' && <ProvidersSection {...panelProps} />}
          {section === 'experts' && <ExpertsSection {...panelProps} />}
          {section === 'terms' && <TermsSection {...panelProps} />}
          {section === 'favorites' && <FavoritesSection />}
          {section === 'shortcuts' && <ShortcutsSection />}
          {section === 'sites' && <SitesSection {...panelProps} />}
          {section === 'data' && <DataSection {...panelProps} />}
        </div>
      </main>
    </div>
  );
}
