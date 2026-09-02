import type { ArtworkSet, QueueItem } from '@nuclearplayer/model';

import {
  createArtworkSetFromUrl,
  isYouTubeOrGenericArtwork,
  resolveTrackCoverUrl,
} from './coverArtResolver';
import { metadataHost } from './metadataHost';
import { useQueueStore } from '../stores/queueStore';

const artworkCache = new Map<string, ArtworkSet>();

export const enrichTrackArtwork = async (item: QueueItem): Promise<void> => {
  const currentFirstUrl = item.track.artwork?.items?.[0]?.url;
  const hasValidArtwork =
    item.track.artwork &&
    item.track.artwork.items?.length > 0 &&
    !isYouTubeOrGenericArtwork(currentFirstUrl);

  if (hasValidArtwork) {
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

  // 1. Try iTunes instant high-res resolver (600x600)
  try {
    const itunesUrl = await resolveTrackCoverUrl(primaryArtist, title);
    if (itunesUrl) {
      const artworkSet = createArtworkSetFromUrl(itunesUrl);
      artworkCache.set(cacheKey, artworkSet);
      useQueueStore.getState().updateItemState(item.id, {
        track: { ...item.track, artwork: artworkSet },
      });
      return;
    }
  } catch {}

  // 2. Try Spotify / metadataHost search
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
    const currentFirstUrl = item.track.artwork?.items?.[0]?.url;
    if (
      !item.track.artwork ||
      !item.track.artwork.items?.length ||
      isYouTubeOrGenericArtwork(currentFirstUrl)
    ) {
      void enrichTrackArtwork(item);
    }
  }
};
