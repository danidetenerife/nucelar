import type { Artwork, ArtworkPurpose, ArtworkSet } from './index';

const BROKEN_YOUTUBE_PATTERNS = [
  '/vi/0/hqdefault.jpg',
  '/vi/0/mqdefault.jpg',
  '/vi/0/sddefault.jpg',
  '/vi/0/default.jpg',
  '/vi_webp/0/',
];

const isBrokenThumbnail = (url: string): boolean => {
  if (!url.includes('i.ytimg.com') && !url.includes('img.youtube.com')) {
    return false;
  }
  return BROKEN_YOUTUBE_PATTERNS.some((pattern) => url.includes(pattern));
};

export function pickArtwork(
  set: ArtworkSet | undefined,
  purpose: ArtworkPurpose,
  targetPx: number,
): Artwork | undefined {
  if (!set?.items?.length) {
    return undefined;
  }

  const candidates = set.items.filter((item) => {
    if (item.purpose && item.purpose !== purpose) {
      return false;
    }
    if (!item.url) {
      return false;
    }
    if (isBrokenThumbnail(item.url)) {
      return false;
    }
    return true;
  });

  if (!candidates.length) {
    const validItems = set.items.filter(
      (item) => item.url && !isBrokenThumbnail(item.url),
    );
    return validItems[0];
  }

  const getAspectRatio = (artwork: Artwork): number => {
    if (!artwork.width || !artwork.height) {
      return 1;
    }
    return artwork.width / artwork.height;
  };

  const getTargetAspectRatio = (p: ArtworkPurpose): number => {
    switch (p) {
      case 'avatar':
      case 'thumbnail':
        return 1;
      case 'cover':
        return 1;
      case 'background':
        return 16 / 9;
      default:
        return 1;
    }
  };

  const targetAspect = getTargetAspectRatio(purpose);

  return candidates
    .map((artwork) => {
      const size = Math.min(artwork.width || 0, artwork.height || 0);
      const aspectDiff = Math.abs(getAspectRatio(artwork) - targetAspect);
      const sizeDiff = Math.abs(size - targetPx);
      const upscaleFactor = size < targetPx ? targetPx / size : 1;

      return {
        artwork,
        score:
          (upscaleFactor > 1.5 ? -1000 : 0) +
          -aspectDiff * 50 +
          -sizeDiff * 0.1,
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.artwork;
}
