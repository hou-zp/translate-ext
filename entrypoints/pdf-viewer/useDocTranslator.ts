import { useCallback, useRef, useState } from 'react';
import type { AppConfig } from '../../src/core/config';
import { sendToBackground } from '../../src/core/messaging';

export interface DocItem {
  key: string;
  text: string;
}

export interface DocProgress {
  done: number;
  total: number;
  running: boolean;
  error: string | null;
}

const CHUNK = 16;

/**
 * Progressive document translation: feeds paragraphs to the background in
 * chunks and exposes a growing key->translation map plus progress state.
 */
export function useDocTranslator(config: AppConfig | null) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<DocProgress>({
    done: 0,
    total: 0,
    running: false,
    error: null,
  });
  const cancelled = useRef(false);

  const start = useCallback(
    async (items: DocItem[]) => {
      if (!config) return;
      cancelled.current = false;
      setResults({});
      setProgress({ done: 0, total: items.length, running: true, error: null });

      let done = 0;
      for (let i = 0; i < items.length; i += CHUNK) {
        if (cancelled.current) break;
        const chunk = items.slice(i, i + CHUNK);
        try {
          const res = await sendToBackground('translateBatch', {
            texts: chunk.map((c) => c.text),
            from: config.sourceLang,
            to: config.targetLang,
            expertId: config.expertId,
          });
          setResults((prev) => {
            const next = { ...prev };
            chunk.forEach((c, j) => {
              const v = res.results[j];
              if (v) next[c.key] = v;
            });
            return next;
          });
          const firstError = res.errors.find((e) => e != null);
          if (firstError) {
            setProgress((p) => ({ ...p, error: firstError.message }));
          }
        } catch (err) {
          setProgress((p) => ({
            ...p,
            error: err instanceof Error ? err.message : String(err),
          }));
        }
        done = Math.min(i + CHUNK, items.length);
        setProgress((p) => ({ ...p, done }));
      }
      setProgress((p) => ({ ...p, running: false }));
    },
    [config],
  );

  const cancel = useCallback(() => {
    cancelled.current = true;
    setProgress((p) => ({ ...p, running: false }));
  }, []);

  return { results, progress, start, cancel };
}
