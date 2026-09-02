import { useQuery } from '@tanstack/react-query';

import { personalizationEngine } from '../../../../services/personalizationEngine';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';

export const useFirstPlayAt = () =>
  useQuery({
    queryKey: ['history', 'firstPlayAt'],
    queryFn: async () => {
      if (isTauriEnvironment()) {
        try {
          return unwrapResult(await commands.historyFirstPlayAt());
        } catch {
          // fallback
        }
      }
      const listens = await personalizationEngine.getListenRecords();
      if (listens.length === 0) return null;
      const oldest = listens.reduce(
        (min, item) => (item.lastPlayedAt < min ? item.lastPlayedAt : min),
        listens[0].lastPlayedAt || Date.now(),
      );
      return { at: oldest };
    },
  });
