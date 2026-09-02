import type { ArtworkSet, QueueItem } from '@nuclearplayer/model';

import { metadataHost } from './metadataHost';
import { useQueueStore } from '../stores/queueStore';

const artworkCache = new Map<string, ArtworkSet>();

export const enrichTrackArtwork = async (item: QueueItem): Promise<void> => {
  if (item.track.artwork && item.track.artwork.items?.length > 0) {
    return;
  }

  const primaryArtist = item.track.artists?.[0]?.name;
  const title = item.track.title;
  if (!primaryArtist || !title) {
    return;
  }

  const cacheKey = `${primaryArtist.toLowerCase().trim()}___${title.toLowerCase().trim()}`;
  if (artworkCache.has(cacheKey)) {
    const cached = artworkCache.get(cacheKey)!;
    useQueueStore.getState().updateItemState(item.id, {
      track: { ...item.track, artwork: cached },
    });
    return;
  }

  try {
    const searchRes = await metadataHost.search({
      query: `${primaryArtist} ${title}`,
      types: ['tracks'],
      limit: 1,
    });

    const match = searchRes?.tracks?.[0];
    if (match?.artwork && match.artwork.items?.length > 0) {
      artworkCache.set(cacheKey, match.artwork);
      useQueueStore.getState().updateItemState(item.id, {
        track: { ...item.track, artwork: match.artwork },
      });
    }
  } catch {
    // Ignore metadata lookup failures
  }
};

export const enrichTracksInQueue = (): void => {
  const items = useQueueStore.getState().items;
  for (const item of items) {
    if (!item.track.artwork || !item.track.artwork.items?.length) {
      void enrichTrackArtwork(item);
    }
  }
};
