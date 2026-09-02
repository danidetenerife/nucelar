import { CellContext } from '@tanstack/react-table';
import { Music } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Artwork, Track } from '@nuclearplayer/model';

const isYouTubeOrGeneric = (url?: string): boolean => {
  if (!url) return true;
  return (
    url.includes('i.ytimg.com') ||
    url.includes('img.youtube.com') ||
    url.includes('googleusercontent.com') ||
    url.includes('/vi/0/') ||
    url.includes('default.jpg')
  );
};

const coverCache = new Map<string, string>();

export const ThumbnailCell = <T extends Track>({
  getValue,
  row,
}: CellContext<T, Artwork>) => {
  const initialUrl = getValue()?.url;
  const track = row.original;
  const primaryArtist = track.artists?.[0]?.name;
  const title = track.title;
  const cacheKey = `${primaryArtist?.toLowerCase().trim()}___${title?.toLowerCase().trim()}`;

  const [hasError, setHasError] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(() => {
    if (initialUrl && !isYouTubeOrGeneric(initialUrl)) {
      return initialUrl;
    }
    if (cacheKey && coverCache.has(cacheKey)) {
      return coverCache.get(cacheKey);
    }
    return undefined;
  });

  useEffect(() => {
    if (initialUrl && !isYouTubeOrGeneric(initialUrl)) {
      setResolvedUrl(initialUrl);
      return;
    }

    if (!primaryArtist || !title) {
      return;
    }

    if (coverCache.has(cacheKey)) {
      setResolvedUrl(coverCache.get(cacheKey));
      return;
    }

    let isMounted = true;
    fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${primaryArtist} ${title}`)}&entity=song&limit=1`,
    )
      .then((res) => res.json())
      .then((data: { results?: Array<{ artworkUrl100?: string }> }) => {
        const rawArtwork = data?.results?.[0]?.artworkUrl100;
        if (rawArtwork && isMounted) {
          const highRes = rawArtwork.replace('100x100bb.jpg', '600x600bb.jpg');
          coverCache.set(cacheKey, highRes);
          setResolvedUrl(highRes);
        } else if (isMounted && initialUrl) {
          setResolvedUrl(initialUrl);
        }
      })
      .catch(() => {
        if (isMounted && initialUrl) {
          setResolvedUrl(initialUrl);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialUrl, primaryArtist, title, cacheKey]);

  const displayUrl =
    resolvedUrl ??
    (initialUrl && !isYouTubeOrGeneric(initialUrl) ? initialUrl : undefined);

  return (
    <td className="w-10 text-center">
      <div className="flex w-full justify-center">
        {displayUrl && !hasError ? (
          <img
            className="h-10 w-10 min-w-10 rounded object-cover"
            src={displayUrl}
            alt=""
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="bg-background-secondary text-foreground-secondary flex h-10 w-10 min-w-10 items-center justify-center rounded">
            <Music size={16} />
          </div>
        )}
      </div>
    </td>
  );
};
