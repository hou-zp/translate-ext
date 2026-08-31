import { useEffect, useState } from 'react';
import { Button, Card, useToast } from '../../../src/components/ui';
import {
  clearFavorites,
  favoritesToAnkiCsv,
  listFavorites,
  removeFavorite,
  type FavoriteEntry,
} from '../../../src/core/favorites';
import { t } from '../../../src/core/i18n';
import { langLabel } from '../../../src/core/langs';
import { downloadFile } from '../shared';

export function FavoritesSection() {
  const toast = useToast();
  const [list, setList] = useState<FavoriteEntry[]>([]);

  const refresh = () => {
    void listFavorites().then(setList);
  };
  useEffect(refresh, []);

  return (
    <Card
      title={t('生词本')}
      desc={t(
        '划词翻译气泡中点击「收藏」即可加入生词本。可导出为 Anki 可导入的 CSV（正面=原文，背面=译文，标签=来源站点）。',
      )}
    >
      <div className="mb-4 flex gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={list.length === 0}
          onClick={() => {
            downloadFile('vocabulary-anki.csv', favoritesToAnkiCsv(list), 'text/csv');
            toast(t('已导出，可在 Anki 中通过「文件 → 导入」导入'), 'success');
          }}
        >
          {t('导出 Anki CSV')}
        </Button>
        {list.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              await clearFavorites();
              refresh();
              toast(t('生词本已清空'), 'success');
            }}
          >
            {t('清空')}
          </Button>
        )}
      </div>
      <div className="max-h-[560px] space-y-2 overflow-y-auto">
        {list.map((f) => (
          <div key={f.id} className="rounded-lg border border-line px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{f.text}</div>
                <div className="mt-0.5 text-sm text-ink-2">{f.translation}</div>
                <div className="mt-1 text-xs text-ink-3">
                  {f.host} · {langLabel(f.targetLang)} · {new Date(f.at).toLocaleDateString()}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs text-danger hover:underline"
                onClick={async () => {
                  await removeFavorite(f.id);
                  refresh();
                }}
              >
                {t('删除')}
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-ink-3">{t('还没有收藏的生词')}</p>}
      </div>
    </Card>
  );
}
