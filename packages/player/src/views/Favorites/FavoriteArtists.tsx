import { useNavigate } from '@tanstack/react-router';
import { Trash2, User } from 'lucide-react';
import { FC, useMemo } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { pickArtwork } from '@nuclearplayer/model';
import { Button, Card, CardGrid, EmptyState, ViewShell } from '@nuclearplayer/ui';

import { useFavoritesStore } from '../../stores/favoritesStore';
import { useProvidersStore } from '../../stores/providersStore';
import { sortByAddedAtDesc } from '../../utils/sort';
import { useArtistCardImage } from './useArtistCardImage';

type ArtistCardProps = {
  name: string;
  localArtworkUrl?: string;
  onClick: () => void;
  onRemove: () => void;
  removeLabel: string;
};

const ArtistCard: FC<ArtistCardProps> = ({
  name,
  localArtworkUrl,
  onClick,
  onRemove,
  removeLabel,
}) => {
  const resolvedSrc = useArtistCardImage(name, localArtworkUrl);
  return (
    <div className="group relative w-42">
      <Card title={name} src={resolvedSrc} onClick={onClick} className="w-full" />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onRemove();
        }}
        title={removeLabel}
        aria-label={removeLabel}
        className="bg-black/60 hover:bg-accent-red text-white absolute top-3.5 right-3.5 z-20 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 focus-visible:opacity-100 shadow-md cursor-pointer"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};

export const FavoriteArtists: FC = () => {
  const { t } = useTranslation('favorites');
  const navigate = useNavigate();
  const { artists, removeArtist, clearArtists } = useFavoritesStore();

  const sortedArtists = useMemo(() => sortByAddedAtDesc(artists), [artists]);

  return (
    <ViewShell data-testid="favorite-artists-view" title={t('artists.title')}>
      {sortedArtists.length === 0 ? (
        <EmptyState
          icon={<User size={48} />}
          title={t('artists.empty')}
          description={t('artists.emptyDescription')}
          className="flex-1"
        />
      ) : (
        <div className="flex w-full flex-col gap-4">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void clearArtists();
              }}
              className="text-accent-red hover:bg-accent-red/10 text-xs font-semibold"
            >
              <Trash2 size={14} className="mr-1 inline" />
              {t('artists.clearAll', 'Borrar todos')}
            </Button>
          </div>
          <CardGrid>
            {sortedArtists.map((entry) => {
              const localArtworkUrl = pickArtwork(
                entry.ref?.artwork,
                'cover',
                300,
              )?.url;
              const artistName = entry.ref?.name ?? 'Unknown Artist';
              const sourceId = entry.ref?.source?.id ?? artistName;
              const sourceProvider = entry.ref?.source?.provider ?? 'spotify';

              return (
                <ArtistCard
                  key={`${sourceProvider}-${sourceId}-${artistName}`}
                  name={artistName}
                  localArtworkUrl={localArtworkUrl}
                  removeLabel={t(
                    'actions.removeFromFavorites',
                    'Eliminar de favoritos',
                  )}
                  onRemove={() => {
                    void removeArtist(entry.ref.source, artistName);
                  }}
                  onClick={() => {
                    const activeMetadata = useProvidersStore.getState().getActive('metadata');
                    const targetProvider = activeMetadata ?? 'spotify';
                    void navigate({
                      to: `/artist/${targetProvider}/${encodeURIComponent(artistName)}`,
                    });
                  }}
                />
              );
            })}
          </CardGrid>
        </div>
      )}
    </ViewShell>
  );
};
