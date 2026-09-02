import { useNavigate } from '@tanstack/react-router';
import { UserIcon } from 'lucide-react';
import { FC, useMemo } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { pickArtwork } from '@nuclearplayer/model';
import { Card, CardGrid } from '@nuclearplayer/ui';

import { useFavoritesStore } from '../../../stores/favoritesStore';
import { useProvidersStore } from '../../../stores/providersStore';

export const PersonalizedArtistsShelf: FC = () => {
  const { t } = useTranslation('navigation');
  const navigate = useNavigate();
  const artists = useFavoritesStore((state) => state.artists);

  const displayArtists = useMemo(() => {
    return artists.slice(0, 12);
  }, [artists]);

  if (displayArtists.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <UserIcon className="text-primary size-5" />
        <h2 className="text-lg font-bold">
          {t('favoriteArtists', 'Tus Artistas Favoritos')}
        </h2>
      </div>
      <CardGrid>
        {displayArtists.map((entry) => {
          const activeMetadata =
            useProvidersStore.getState().getActive('metadata') ?? 'spotify';
          return (
            <Card
              key={`${entry.ref.name}`}
              title={entry.ref.name}
              src={pickArtwork(entry.ref.artwork, 'cover', 300)?.url}
              onClick={() =>
                navigate({
                  to: `/artist/${activeMetadata}/${encodeURIComponent(entry.ref.name)}`,
                })
              }
            />
          );
        })}
      </CardGrid>
    </div>
  );
};
