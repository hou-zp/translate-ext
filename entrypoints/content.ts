import { defineContentScript } from '#imports';
import {
  findSiteRule,
  loadConfig,
  onConfigChanged,
  siteMode,
  type AppConfig,
  type SiteRule,
} from '../src/core/config';
import { onContentMessage } from '../src/core/messaging';
import { PageTranslationController } from '../src/content/controller';
import { FloatBall } from '../src/content/float-button';
import { HoverTranslator } from '../src/content/hover';
import { showImageTranslation } from '../src/content/image-translate';
import { InputTranslator } from '../src/content/input-translate';
import { ParagraphRenderer } from '../src/content/renderer';
import { ProgressPill } from '../src/content/progress-pill';
import { fillSingleImage, toggleMangaMode } from '../src/content/manga';
import { SelectionBubble } from '../src/content/selection';
import { injectStyles } from '../src/content/styles';
import { VideoCaptionWatcher } from '../src/content/video-captions';
import { YouTubeSubtitles } from '../src/content/youtube';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_idle',
  async main() {
    if (!document.body) return;
    const isTopFrame = window.self === window.top;

    let cfg: AppConfig = await loadConfig();
    let rule: SiteRule | null = findSiteRule(cfg, location.hostname);
    const mode = siteMode(cfg, location.hostname);

    injectStyles();

    const renderer = new ParagraphRenderer(
      () => rule?.displayMode ?? cfg.displayMode,
      () => rule?.translationStyle ?? cfg.translationStyle,
    );
    const controller = new PageTranslationController(renderer, () => rule);

    // UI features live only in the top frame; translation runs in every frame.
    let ball: FloatBall | null = null;
    let bubble: SelectionBubble | null = null;
    new InputTranslator(() => cfg);
    let ytSubs: YouTubeSubtitles | null = null;
    if (isTopFrame) {
      new HoverTranslator(renderer, () => cfg);
      bubble = new SelectionBubble(() => cfg);
      if (mode !== 'never') {
        ball = new FloatBall(controller, () => cfg);
        ball.sync();
      }
      if (location.hostname.endsWith('youtube.com')) {
        ytSubs = new YouTubeSubtitles(() => cfg);
      }
    }
    // caption watcher runs in every frame: some players live inside iframes
    const capWatcher = new VideoCaptionWatcher(() => cfg);

    // bottom-right progress pill while a full-page translation is running
    let pill: ProgressPill | null = null;
    let pillTimer: ReturnType<typeof setInterval> | undefined;
    const trackProgress = () => {
      if (!isTopFrame) return;
      const p = (pill ??= new ProgressPill(() => controller.restore()));
      if (pillTimer) clearInterval(pillTimer);
      pillTimer = setInterval(() => {
        if (!controller.active) {
          clearInterval(pillTimer);
          pillTimer = undefined;
          p.hide();
          return;
        }
        p.update(controller.doneCount, controller.totalCount);
      }, 500);
    };

    onConfigChanged((next) => {
      cfg = next;
      rule = findSiteRule(cfg, location.hostname);
      ball?.sync();
      ytSubs?.sync();
      capWatcher.sync();
    });

    onContentMessage({
      ping: () => ({ pong: true as const }),
      translatePage: async () => {
        const translated = await controller.toggle();
        if (translated) trackProgress();
        return { translated };
      },
      restorePage: () => {
        controller.restore();
      },
      getPageState: () => ({
        translated: controller.active,
        total: controller.totalCount,
        done: controller.doneCount,
      }),
      translateSelection: async ({ text }) => {
        await bubble?.translateCurrentSelection(text);
      },
      translateImage: async ({ srcUrl }) => {
        await showImageTranslation(srcUrl, cfg);
      },
      translateImageFill: async ({ srcUrl }) => {
        await fillSingleImage(srcUrl, cfg);
      },
      mangaMode: async () => toggleMangaMode(cfg),
    });

    // Auto-translate sites from the "always translate" list.
    if (mode === 'always') {
      void controller.start().then(trackProgress);
    }
  },
});
