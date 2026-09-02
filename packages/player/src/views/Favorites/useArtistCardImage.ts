import { useEffect, useState } from 'react';

import type { MetadataProvider } from '@nuclearplayer/plugin-sdk';

import { providersHost } from '../../services/providersHost';
import { useProvidersStore } from '../../stores/providersStore';

const imageCache = new Map<string, string>();

export const useArtistCardImage = (
  artistName: string,
  localArtworkUrl?: string,
): string | undefined => {
  const activeProviderId = useProvidersStore((state) =>
    state.getActive('metadata'),
  );

  const isYtThumbnail =
    typeof localArtworkUrl === 'string' &&
    localArtworkUrl.includes('i.ytimg.com');

  const usableLocalUrl = !isYtThumbnail ? localArtworkUrl : undefined;

  const cacheKey = activeProviderId ? `${activeProviderId}:${artistName}` : '';
  const cachedUrl = cacheKey ? imageCache.get(cacheKey) : undefined;

  const initialUrl = usableLocalUrl ?? cachedUrl;
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(initialUrl);

  useEffect(() => {
    if (usableLocalUrl) {
      setResolvedUrl(usableLocalUrl);
      return;
    }

    if (cachedUrl) {
      setResolvedUrl(cachedUrl);
      return;
    }

    if (!activeProviderId || !artistName) {
      return;
    }

    const provider = providersHost.get<MetadataProvider>(
      activeProviderId,
      'metadata',
    );
    if (!provider?.searchArtists) {
      return;
    }

    let cancelled = false;
    provider
      .searchArtists({ query: artistName, limit: 1 })
      .then((results) => {
        if (cancelled) return;
        const artwork = results?.[0]?.artwork;
        const imageUrl = artwork?.items?.[0]?.url;
        if (imageUrl) {
          imageCache.set(cacheKey, imageUrl);
          setResolvedUrl(imageUrl);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [artistName, activeProviderId, usableLocalUrl, cachedUrl, cacheKey]);

  return resolvedUrl;
};
