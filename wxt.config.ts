import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

/**
 * The ONNX wasm binary is downloaded at runtime and cached in OPFS
 * (see src/core/manga-detector.ts), so drop the copy the bundler emits.
 */
function dropBundledOrtWasm() {
  return {
    name: 'drop-bundled-ort-wasm',
    generateBundle(_opts: unknown, bundle: Record<string, unknown>) {
      for (const name of Object.keys(bundle)) {
        if (/ort-wasm.*\.wasm$/.test(name)) delete bundle[name];
      }
    },
  };
}

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss(), dropBundledOrtWasm()],
  }),
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'zh_CN',
    permissions: [
      'storage',
      'unlimitedStorage',
      'activeTab',
      'scripting',
      'contextMenus',
      'tabs',
      'alarms',
      // side panel + offscreen APIs are chromium-only
      ...(browser === 'chrome' || browser === 'edge' ? ['sidePanel', 'offscreen'] : []),
    ],
    // wasm-unsafe-eval: local ONNX inference (manga text detector, chromium MV3)
    ...(browser === 'chrome' || browser === 'edge'
      ? {
          content_security_policy: {
            extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
          },
        }
      : {}),
    ...(browser === 'chrome' || browser === 'edge'
      ? { side_panel: { default_path: 'sidepanel.html' } }
      : {}),
    host_permissions: ['<all_urls>'],
    // let the float ball embed the full popup panel in an iframe on any page
    web_accessible_resources: [
      {
        resources: ['popup.html', 'chunks/*', 'assets/*'],
        matches: ['<all_urls>'],
      },
    ],
    commands: {
      'translate-page': {
        suggested_key: { default: 'Alt+A' },
        description: '__MSG_cmdTranslatePage__',
      },
      'toggle-hover': {
        description: '__MSG_cmdToggleHover__',
      },
      'toggle-selection': {
        description: '__MSG_cmdToggleSelection__',
      },
    },
  }),
});
