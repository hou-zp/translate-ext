import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button, Card } from '../../../src/components/ui';
import { t } from '../../../src/core/i18n';
import { sendToBackground } from '../../../src/core/messaging';

export function ShortcutsSection() {
  const [commands, setCommands] = useState<
    { name?: string; description?: string; shortcut?: string }[]
  >([]);

  useEffect(() => {
    void browser.commands?.getAll().then(setCommands);
  }, []);

  return (
    <Card title={t('键盘快捷键')} desc={t('快捷键需要在浏览器的扩展快捷键页面中修改。')}>
      <div className="space-y-2">
        {commands.map((c) => (
          <div
            key={c.name}
            className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
          >
            <span className="text-sm text-ink">{c.description || c.name}</span>
            <kbd className="rounded-md border border-line bg-fill px-2 py-0.5 text-xs text-ink-2">
              {c.shortcut || t('未设置')}
            </kbd>
          </div>
        ))}
      </div>
      <Button
        variant="primary"
        size="sm"
        className="mt-3"
        onClick={() => void sendToBackground('openPage', { page: 'shortcuts' })}
      >
        {t('打开浏览器快捷键设置')}
      </Button>
    </Card>
  );
}
