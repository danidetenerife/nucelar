import { useEffect, useRef } from 'react';

import type { QueueItem } from '@nuclearplayer/model';

import { streamResolution } from '../services/streamResolution';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { useStreamRecovery } from './useStreamRecovery';

const buildResolutionKey = (item: QueueItem): string => {
  const headCandidate = item.track.streamCandidates?.[0];
  return [item.id, headCandidate?.id, headCandidate?.failed].join(':');
};

export const useStreamResolution = (): void => {
  const currentItemIdRef = useRef<string | null>(null);
  const resolutionKeyRef = useRef<string | null>(null);
  const isFirstResolutionRef = useRef(true);

  useStreamRecovery();

  useEffect(() => {
    const onCurrentItemChanged = (currentItem: QueueItem | undefined): void => {
      if (!currentItem) {
        currentItemIdRef.current = null;
        return;
      }

      const isSameItem = currentItemIdRef.current === currentItem.id;
      currentItemIdRef.current = currentItem.id;

      const resolutionKey = buildResolutionKey(currentItem);
      if (resolutionKey === resolutionKeyRef.current && isSameItem) {
        return;
      }
      resolutionKeyRef.current = resolutionKey;

      if (currentItem.status === 'loading') {
        return;
      }

      // Only skip if the exact SAME item is already actively playing
      if (
        isSameItem &&
        currentItem.status === 'success' &&
        useSoundStore.getState().status === 'playing'
      ) {
        return;
      }

      const autoPlay = !isFirstResolutionRef.current;
      isFirstResolutionRef.current = false;
      void streamResolution.resolve(currentItem, { autoPlay });
    };

    const unsubscribe = useQueueStore.subscribe((state) => {
      onCurrentItemChanged(state.getCurrentItem());
    });

    onCurrentItemChanged(useQueueStore.getState().getCurrentItem());

    return unsubscribe;
  }, []);
};
