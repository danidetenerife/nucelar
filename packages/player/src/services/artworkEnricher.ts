import type { ArtworkSet, QueueItem, Track } from '@nuclearplayer/model';

import {
  createArtworkSetFromUrl,
  isYouTubeOrGenericArtwork,
  resolveTrackCoverUrl,
} from './coverArtResolver';
import { metadataHost } from './metadataHost';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useQueueStore } from '../stores/queueStore';

const artworkCache = new Map<string, ArtworkSet>();

export const resolveArtworkForTrack = async (
  track: Track,
): Promise<ArtworkSet | null> => {
  const currentFirstUrl = track.artwork?.items?.[0]?.url;
  const hasValidArtwork =
    track.artwork &&
    track.artwork.items?.length > 0 &&
    !isYouTubeOrGenericArtwork(currentFirstUrl);

  if (hasValidArtwork && track.artwork) {
    return track.artwork;
  }

  const primaryArtist = track.artists?.[0]?.name;
  const title = track.title;
  if (!primaryArtist || !title) {
    return null;
  }

  const cacheKey = `${primaryArtist.toLowerCase().trim()}___${title.toLowerCase().trim()}`;
  if (artworkCache.has(cacheKey)) {
    return artworkCache.get(cacheKey)!;
  }

  // 1. Try iTunes instant high-res resolver (600x600)
  try {
    const itunesUrl = await resolveTrackCoverUrl(primaryArtist, title);
    if (itunesUrl) {
      const artworkSet = createArtworkSetFromUrl(itunesUrl);
      artworkCache.set(cacheKey, artworkSet);
      return artworkSet;
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
      return match.artwork;
    }
  } catch {}

  return null;
};

export const enrichTrackArtwork = async (item: QueueItem): Promise<void> => {
  const artwork = await resolveArtworkForTrack(item.track);
  if (artwork) {
    const currentItem = useQueueStore.getState().getItemById(item.id);
    if (!currentItem) {
      return;
    }
    useQueueStore.getState().updateItemState(item.id, {
      track: { ...currentItem.track, artwork },
    });
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

export const enrichFavoriteTracks = async (): Promise<void> => {
  const favorites = useFavoritesStore.getState().tracks;
  let hasUpdates = false;

  const updatedFavorites = await Promise.all(
    favorites.map(async (entry) => {
      const currentFirstUrl = entry.ref.artwork?.items?.[0]?.url;
      if (
        !entry.ref.artwork ||
        !entry.ref.artwork.items?.length ||
        isYouTubeOrGenericArtwork(currentFirstUrl)
      ) {
        const enrichedArtwork = await resolveArtworkForTrack(entry.ref);
        if (enrichedArtwork) {
          hasUpdates = true;
          return {
            ...entry,
            ref: {
              ...entry.ref,
              artwork: enrichedArtwork,
            },
          };
        }
      }
      return entry;
    }),
  );

  if (hasUpdates) {
    useFavoritesStore.setState({ tracks: updatedFavorites });
  }
};
