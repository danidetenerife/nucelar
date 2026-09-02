import { useQuery } from '@tanstack/react-query';

import type { TimeRange } from '../../../../services/tauri/bindings';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';

export const useHourlyListeningTime = (range: TimeRange) =>
  useQuery({
    queryKey: ['history', 'stats', 'hourly', range.from, range.to],
    queryFn: async () => {
      if (isTauriEnvironment()) {
        try {
          return unwrapResult(await commands.historyHourlyListeningTime(range))
            .values;
        } catch {
          // fallback
        }
      }
      return new Array(24).fill(0);
    },
  });
