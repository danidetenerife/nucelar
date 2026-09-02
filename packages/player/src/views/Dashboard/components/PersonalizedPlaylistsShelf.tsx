import { useNavigate } from '@tanstack/react-router';
import { ListMusicIcon } from 'lucide-react';
import { FC, useMemo } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { Card, CardGrid } from '@nuclearplayer/ui';

import { usePlaylistStore } from '../../../stores/playlistStore';
import { PlaylistArtwork } from '../../Playlists/components/PlaylistArtwork';

export const PersonalizedPlaylistsShelf: FC = () => {
  const { t } = useTranslation('navigation');
  const navigate = useNavigate();
  const index = usePlaylistStore((state) => state.index);

  const playlistList = useMemo(() => {
    return Object.values(index).slice(0, 6);
  }, [index]);

  if (playlistList.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ListMusicIcon className="text-primary size-5" />
        <h2 className="text-lg font-bold">
          {t('playlists', 'Tus Listas de Reproducción')}
        </h2>
      </div>
      <CardGrid>
        {playlistList.map((playlist) => (
          <Card
            key={playlist.id}
            image={
              <PlaylistArtwork
                name={playlist.name}
                thumbnails={playlist.thumbnails}
              />
            }
            title={playlist.name}
            subtitle={`${playlist.itemCount} canciones`}
            onClick={() =>
              navigate({
                to: `/playlist/${playlist.id}`,
              })
            }
          />
        ))}
      </CardGrid>
    </div>
  );
};
