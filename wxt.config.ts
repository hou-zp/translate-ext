import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
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
      // side panel API is chromium-only
      ...(browser === 'chrome' || browser === 'edge' ? ['sidePanel'] : []),
    ],
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
