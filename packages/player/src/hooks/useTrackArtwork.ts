import { useEffect, useMemo, useState } from 'react';

import { pickArtwork, type Track } from '@nuclearplayer/model';

import {
  isYouTubeOrGenericArtwork,
  resolveTrackCoverUrl,
} from '../services/coverArtResolver';

export const useTrackArtwork = (
  track?: Track,
  targetPx = 128,
): string | undefined => {
  const primaryArtist = track?.artists?.[0]?.name;
  const title = track?.title;

  const baseArtworkUrl = useMemo(() => {
    if (!track) return undefined;
    const picked =
      pickArtwork(track.artwork, 'thumbnail', targetPx) ??
      pickArtwork(track.album?.artwork, 'thumbnail', targetPx);
    const candidateUrl = track.streamCandidates?.find(
      (c) => c.thumbnail && !isYouTubeOrGenericArtwork(c.thumbnail),
    )?.thumbnail;

    return picked?.url ?? candidateUrl;
  }, [track, targetPx]);

  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
    baseArtworkUrl && !isYouTubeOrGenericArtwork(baseArtworkUrl)
      ? baseArtworkUrl
      : undefined,
  );

  useEffect(() => {
    if (baseArtworkUrl && !isYouTubeOrGenericArtwork(baseArtworkUrl)) {
      setResolvedUrl(baseArtworkUrl);
      return;
    }

    if (!primaryArtist || !title) {
      setResolvedUrl(undefined);
      return;
    }

    let isMounted = true;
    resolveTrackCoverUrl(primaryArtist, title)
      .then((url) => {
        if (isMounted && url) {
          setResolvedUrl(url);
        } else if (isMounted && baseArtworkUrl) {
          setResolvedUrl(baseArtworkUrl);
        }
      })
      .catch(() => {
        if (isMounted) {
          setResolvedUrl(baseArtworkUrl);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [baseArtworkUrl, primaryArtist, title]);

  return resolvedUrl;
};
