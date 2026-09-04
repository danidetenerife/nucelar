import { useEffect, useRef } from 'react';

import type { QueueItem } from '@nuclearplayer/model';

import { streamResolution } from '../services/streamResolution';
import { useQueueStore } from '../stores/queueStore';
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

      if (currentItem.status === 'loading' || currentItem.status === 'success') {
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
