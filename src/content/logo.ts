/**
 * Simplified brand mark for tiny injected chrome (float ball, selection
 * trigger): a bone-stroked bubble with speech tail overlapped by a solid
 * cinnabar bubble. Matches the small-size variant in scripts/gen-icons.mjs —
 * the detailed 文/A glyph doesn't survive below ~32px, so we don't draw it.
 */
export const LOGO_MARK_SVG = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="4" y="5" width="22" height="19" rx="5" fill="none" stroke="#e9e4d8" stroke-width="3"/><path d="M10.5 23.5v5l5-5" fill="none" stroke="#e9e4d8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="15" y="16" width="22" height="19" rx="5" fill="#d5482f"/></svg>`;

export function logoElement(): SVGSVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = LOGO_MARK_SVG.trim();
  return tpl.content.firstElementChild as SVGSVGElement;
}
