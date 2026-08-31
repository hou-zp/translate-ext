import { useEffect, useState } from 'react';
import { Button, Card, Field, Input, Row, Toggle, useToast } from '../../../src/components/ui';
import { replaceConfig, type AppConfig } from '../../../src/core/config';
import { t } from '../../../src/core/i18n';
import { sendToBackground } from '../../../src/core/messaging';
import { applyBackup, webdavDownload, webdavUpload } from '../../../src/core/sync';
import type { PanelProps } from '../shared';

export function DataSection({ config, update }: PanelProps) {
  const toast = useToast();
  const [stats, setStats] = useState<{ entries: number; chars: number } | null>(null);
  const [davBusy, setDavBusy] = useState<'up' | 'down' | null>(null);

  const refreshStats = () => {
    void sendToBackground('getCacheStats', undefined).then(setStats);
  };
  useEffect(refreshStats, []);

  const davUpload = async () => {
    setDavBusy('up');
    try {
      await webdavUpload(config);
      toast(t('已上传到云端'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setDavBusy(null);
    }
  };

  const davDownload = async () => {
    setDavBusy('down');
    try {
      const backup = await webdavDownload(config);
      await applyBackup(backup);
      toast(`${t('已恢复备份')} (${new Date(backup.exportedAt).toLocaleString()})`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setDavBusy(null);
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translate-ext-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (file: File) => {
    void file.text().then(async (text) => {
      try {
        const cfg = JSON.parse(text) as AppConfig;
        await replaceConfig(cfg);
        toast(t('配置已导入'), 'success');
      } catch {
        toast(t('配置文件格式错误'), 'error');
      }
    });
  };

  return (
    <>
      <Card title={t('译文缓存')} desc={t('相同段落的译文会被缓存，避免重复请求。')}>
        <Row label={t('启用缓存')}>
          <Toggle checked={config.cacheEnabled} onChange={(v) => update({ cacheEnabled: v })} />
        </Row>
        <p className="mb-3 text-sm text-ink-3">
          {t('当前缓存')} {stats?.entries ?? '…'} {t('条译文，约')}{' '}
          {((stats?.chars ?? 0) / 1024).toFixed(1)} KB
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={async () => {
            await sendToBackground('clearCache', undefined);
            refreshStats();
            toast(t('缓存已清空'), 'success');
          }}
        >
          {t('清空缓存')}
        </Button>
      </Card>

      <Card
        title={t('云同步')}
        desc={t(
          '浏览器同步：配置自动跟随浏览器账号在多设备间同步（含 API Key）。WebDAV：手动把完整配置 + 生词本备份到坚果云等网盘。',
        )}
      >
        <Row label={t('通过浏览器账号自动同步配置')}>
          <Toggle checked={config.syncEnabled} onChange={(v) => update({ syncEnabled: v })} />
        </Row>
        <div className="mt-2 grid grid-cols-1 gap-3">
          <Field label={t('WebDAV 地址（如 https://dav.jianguoyun.com/dav/translate-ext/）')}>
            <Input
              value={config.webdavUrl}
              placeholder="https://dav.example.com/translate-ext/"
              onChange={(e) => update({ webdavUrl: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('账号')}>
              <Input
                value={config.webdavUser}
                onChange={(e) => update({ webdavUser: e.target.value })}
              />
            </Field>
            <Field label={t('密码 / 应用密码')}>
              <Input
                type="password"
                value={config.webdavPass}
                onChange={(e) => update({ webdavPass: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="mt-1 flex gap-3">
          <Button
            variant="primary"
            size="sm"
            disabled={davBusy !== null}
            loading={davBusy === 'up'}
            onClick={() => void davUpload()}
          >
            {davBusy === 'up' ? t('上传中') + '…' : t('上传到云端')}
          </Button>
          <Button
            size="sm"
            disabled={davBusy !== null}
            loading={davBusy === 'down'}
            onClick={() => void davDownload()}
          >
            {davBusy === 'down' ? t('恢复中') + '…' : t('从云端恢复')}
          </Button>
        </div>
      </Card>

      <Card title={t('配置导入导出')} desc={t('导出的 JSON 包含 API Key，请妥善保管。')}>
        <div className="flex gap-3">
          <Button variant="primary" size="sm" onClick={exportConfig}>
            {t('导出配置')}
          </Button>
          <label className="cursor-pointer rounded-lg border border-line bg-card px-4 py-1.5 text-sm text-ink-2 transition-colors hover:bg-fill">
            {t('导入配置')}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importConfig(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </Card>
    </>
  );
}
