import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import type { AlbumRef, ArtistRef, ProviderRef } from '@nuclearplayer/model';
import { FavoriteButton } from '@nuclearplayer/ui';

import { useFavoritesStore } from '../stores/favoritesStore';

type ConnectedFavoriteButtonProps = {
  className?: string;
  'data-testid'?: string;
} & (
  | { type: 'album'; source: ProviderRef; data: Omit<AlbumRef, 'source'> }
  | { type: 'artist'; source: ProviderRef; data: Omit<ArtistRef, 'source'> }
);

export const ConnectedFavoriteButton: FC<ConnectedFavoriteButtonProps> = (
  props,
) => {
  const { t } = useTranslation('track');
  const {
    isAlbumFavorite,
    isArtistFavorite,
    addAlbum,
    addArtist,
    removeAlbum,
    removeArtist,
  } = useFavoritesStore();

  const { type, source, data, className, 'data-testid': testId } = props;

  const isFavorite =
    type === 'album'
      ? isAlbumFavorite(source)
      : isArtistFavorite(source, (data as Omit<ArtistRef, 'source'>).name);

  const handleToggle = () => {
    if (type === 'album') {
      if (isFavorite) {
        removeAlbum(source);
      } else {
        addAlbum({ ...(data as Omit<AlbumRef, 'source'>), source });
      }
    } else {
      const artistData = data as Omit<ArtistRef, 'source'>;
      if (isFavorite) {
        removeArtist(source, artistData.name);
      } else {
        addArtist({ ...artistData, source });
      }
    }
  };

  return (
    <FavoriteButton
      isFavorite={isFavorite}
      onToggle={handleToggle}
      className={className}
      data-testid={testId}
      ariaLabelAdd={t('actions.addToFavorites')}
      ariaLabelRemove={t('actions.removeFromFavorites')}
    />
  );
};
