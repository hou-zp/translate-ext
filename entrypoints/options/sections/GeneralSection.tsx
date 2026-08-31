import type { CSSProperties } from 'react';
import { Card, Field, Row, Segmented, Select, Toggle } from '../../../src/components/ui';
import type { AppConfig, HoverModifier, TranslationStyle } from '../../../src/core/config';
import { t } from '../../../src/core/i18n';
import { LANGS } from '../../../src/core/langs';
import { TRANSLATION_STYLES } from '../../../src/content/style-defs';
import { STYLE_OPTIONS, type PanelProps } from '../shared';

export function GeneralSection({ config, update }: PanelProps) {
  return (
    <>
      <Card title={t('默认语言')}>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('源语言')}>
            <Select
              variant="field"
              value={config.sourceLang}
              onChange={(v) => update({ sourceLang: v })}
              options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
            />
          </Field>
          <Field label={t('目标语言')}>
            <Select
              variant="field"
              value={config.targetLang}
              onChange={(v) => update({ targetLang: v })}
              options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
                value: l.code,
                label: l.label,
              }))}
            />
          </Field>
        </div>
      </Card>

      <Card
        title={t('译文显示')}
        desc={t('双语对照会把译文插在原文下方；替换模式直接用译文替换原文，可随时还原。')}
      >
        <Segmented
          className="mb-4 max-w-xs"
          value={config.displayMode}
          onChange={(v) => update({ displayMode: v as AppConfig['displayMode'] })}
          options={[
            { value: 'bilingual', label: t('双语对照') },
            { value: 'replace', label: t('替换原文') },
          ]}
        />
        <div className="mb-1.5 text-xs font-medium text-ink-2">{t('译文样式')}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => update({ translationStyle: s.value })}
              className={`rounded-xl border p-3 text-left transition-colors duration-150 ${
                config.translationStyle === s.value
                  ? 'border-brand bg-brand-soft ring-1 ring-brand/40'
                  : 'border-line hover:bg-fill'
              }`}
            >
              <span
                className="block text-sm text-ink"
                style={TRANSLATION_STYLES[s.value] as CSSProperties}
              >
                {t('译文示例')}
              </span>
              <span className="mt-2 block text-[11px] text-ink-3">{s.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-fill p-4 text-sm leading-7">
          <p className="text-ink">The quick brown fox jumps over the lazy dog.</p>
          <p
            className="mt-1 text-ink"
            style={TRANSLATION_STYLES[config.translationStyle as TranslationStyle] as CSSProperties}
          >
            敏捷的棕色狐狸跳过了那只懒狗。
          </p>
        </div>
      </Card>

      <Card title={t('交互功能')}>
        <div className="divide-y divide-line/60">
          <Row label={t('划词翻译')} desc={t('选中文字后显示翻译按钮')}>
            <Toggle
              checked={config.selectionEnabled}
              onChange={(v) => update({ selectionEnabled: v })}
            />
          </Row>
          <Row label={t('鼠标悬停翻译')} desc={t('悬停段落时就地翻译该段')}>
            <Toggle checked={config.hoverEnabled} onChange={(v) => update({ hoverEnabled: v })} />
          </Row>
          <Row label={t('悬停触发条件')}>
            <Select
              variant="field"
              className="w-56"
              value={config.hoverModifier}
              onChange={(v) => update({ hoverModifier: v as HoverModifier })}
              options={[
                { value: 'shift', label: t('按住 Shift 悬停') },
                { value: 'alt', label: t('按住 Alt / Option 悬停') },
                { value: 'ctrl', label: t('按住 Ctrl / Cmd 悬停') },
                { value: 'none', label: t('直接悬停（无需按键）') },
              ]}
            />
          </Row>
          <Row label={t('页面悬浮球')} desc={t('在网页右侧显示快捷翻译入口')}>
            <Toggle
              checked={config.floatButtonEnabled}
              onChange={(v) => update({ floatButtonEnabled: v })}
            />
          </Row>
          <Row
            label={t('输入框翻译')}
            desc={t('在任意输入框中输入母语后快速按 3 次空格，原地替换为目标语言')}
          >
            <Toggle
              checked={config.inputTranslateEnabled}
              onChange={(v) => update({ inputTranslateEnabled: v })}
            />
          </Row>
          <Row label={t('输入框翻译目标语言')}>
            <Select
              variant="field"
              className="w-56"
              value={config.inputTranslateLang}
              onChange={(v) => update({ inputTranslateLang: v })}
              options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
                value: l.code,
                label: l.label,
              }))}
            />
          </Row>
          <Row
            label={t('YouTube 双语字幕')}
            desc={t('在 YouTube 播放器上叠加翻译字幕（需要视频本身带字幕轨）')}
          >
            <Toggle
              checked={config.youtubeSubtitlesEnabled}
              onChange={(v) => update({ youtubeSubtitlesEnabled: v })}
            />
          </Row>
          <Row
            label={t('视频网站双语字幕（Beta）')}
            desc={t(
              'Netflix / B 站 / Coursera / Udemy / Prime Video / Disney+ / Vimeo，跟随播放器原生字幕实时翻译',
            )}
          >
            <Toggle
              checked={config.videoSubtitlesEnabled}
              onChange={(v) => update({ videoSubtitlesEnabled: v })}
            />
          </Row>
          <Row
            label={t('会议实时字幕翻译（Beta）')}
            desc={t('Google Meet / Zoom 网页版 / Teams，需先在会议中开启平台自带的实时字幕（CC）')}
          >
            <Toggle
              checked={config.meetingCaptionsEnabled}
              onChange={(v) => update({ meetingCaptionsEnabled: v })}
            />
          </Row>
        </div>
      </Card>

      <Card
        title={t('AI 精翻')}
        desc={t('开启后先用当前服务快速翻译，再交给 AI 模型按所选专家风格润色替换。')}
      >
        <div className="divide-y divide-line/60">
          <Row label={t('默认启用 AI 精翻')}>
            <Toggle checked={config.refineEnabled} onChange={(v) => update({ refineEnabled: v })} />
          </Row>
          <Row
            label={t('AI 上下文翻译')}
            desc={t(
              '整页翻译前先让 AI 总结全文并提取术语，注入每批段落的提示词，减少代词与多义词误译（每页多一次模型调用）',
            )}
          >
            <Toggle
              checked={config.contextEnabled}
              onChange={(v) => update({ contextEnabled: v })}
            />
          </Row>
          <Row label={t('精翻使用的模型服务（当主服务不是 AI 时）')}>
            <Select
              variant="field"
              className="w-56"
              value={config.refineProvider}
              onChange={(v) => update({ refineProvider: v as 'openai' | 'ollama' })}
              options={[
                { value: 'ollama', label: t('Ollama（本地）') },
                { value: 'openai', label: t('OpenAI 兼容') },
              ]}
            />
          </Row>
        </div>
      </Card>
    </>
  );
}
