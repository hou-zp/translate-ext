import { useCallback, useEffect, useState } from 'react';
import {
  loadConfig,
  onConfigChanged,
  saveConfig,
  type AppConfig,
} from '../core/config';

/** Live app config synced across all extension contexts. */
export function useConfig(): {
  config: AppConfig | null;
  update: (patch: Partial<AppConfig>) => void;
} {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadConfig().then((c) => {
      if (mounted) setConfig(c);
    });
    const unsub = onConfigChanged((c) => {
      if (mounted) setConfig(c);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const update = useCallback((patch: Partial<AppConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
    void saveConfig(patch);
  }, []);

  return { config, update };
}
