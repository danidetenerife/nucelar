import type { ArtworkSet } from '@nuclearplayer/model';

const memoryCache = new Map<string, string>();
const LOCAL_STORAGE_KEY_PREFIX = 'nuclear_cover_';

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/ft\..*|feat\..*/gi, '')
    .trim();

export const isYouTubeOrGenericArtwork = (url?: string): boolean => {
  if (!url) return true;
  return (
    url.includes('i.ytimg.com') ||
    url.includes('img.youtube.com') ||
    url.includes('googleusercontent.com') ||
    url.includes('/vi/0/') ||
    url.includes('default.jpg')
  );
};

export const resolveTrackCoverUrl = async (
  artist: string,
  title: string,
): Promise<string | null> => {
  if (!artist || !title) return null;

  const cacheKey = `${normalizeText(artist)}___${normalizeText(title)}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  // Check localStorage cache
  try {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${cacheKey}`);
    if (cached) {
      memoryCache.set(cacheKey, cached);
      return cached;
    }
  } catch {}

  const queries = [
    `${artist} ${title}`,
    `${normalizeText(artist)} ${normalizeText(title)}`,
  ];

  for (const query of queries) {
    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`,
      );
      if (!response.ok) continue;

      const data = (await response.json()) as {
        results?: Array<{ artworkUrl100?: string }>;
      };

      const rawArtwork = data?.results?.[0]?.artworkUrl100;
      if (rawArtwork) {
        // Upgrade iTunes thumbnail to high-res 600x600
        const highResUrl = rawArtwork.replace('100x100bb.jpg', '600x600bb.jpg');
        memoryCache.set(cacheKey, highResUrl);
        try {
          localStorage.setItem(
            `${LOCAL_STORAGE_KEY_PREFIX}${cacheKey}`,
            highResUrl,
          );
        } catch {}
        return highResUrl;
      }
    } catch {
      // Ignore network errors
    }
  }

  return null;
};

export const createArtworkSetFromUrl = (url: string): ArtworkSet => ({
  items: [
    {
      url,
      purpose: 'cover',
      width: 600,
      height: 600,
      source: { provider: 'itunes', id: 'cover' },
    },
  ],
});
