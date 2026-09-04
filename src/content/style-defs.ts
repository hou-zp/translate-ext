import type { TranslationStyle } from '../core/config';

/**
 * Single source of truth for the five translation styles. The content script
 * turns these into `.txe-style-*` CSS rules; the options page uses them
 * directly as inline styles for live previews.
 */
export const TRANSLATION_STYLES: Record<TranslationStyle, Record<string, string>> = {
  plain: {},
  underline: {
    borderBottom: '1px solid rgba(213, 72, 47, 0.55)',
    paddingBottom: '1px',
    width: 'fit-content',
    maxWidth: '100%',
  },
  dashed: {
    borderBottom: '1px dashed rgba(213, 72, 47, 0.7)',
    paddingBottom: '1px',
    width: 'fit-content',
    maxWidth: '100%',
  },
  quote: {
    borderLeft: '3px solid rgba(213, 72, 47, 0.6)',
    paddingLeft: '8px',
    opacity: '0.92',
  },
  highlight: {
    background: 'rgba(213, 72, 47, 0.10)',
    borderRadius: '3px',
    padding: '0 3px',
    width: 'fit-content',
    maxWidth: '100%',
  },
};

export function styleDeclToCss(decl: Record<string, string>): string {
  return Object.entries(decl)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${v};`)
    .join(' ');
}
