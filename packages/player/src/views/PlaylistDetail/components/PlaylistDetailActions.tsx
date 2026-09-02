import { useNavigate } from '@tanstack/react-router';
import { CopyIcon, ShareIcon, Trash2Icon } from 'lucide-react';
import { useState, type FC } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@nuclearplayer/i18n';
import type { Playlist, Track } from '@nuclearplayer/model';
import { Button, Dialog, Popover } from '@nuclearplayer/ui';

import { usePlaylistExport } from '../../../hooks/usePlaylistExport';
import { usePlaylistStore } from '../../../stores/playlistStore';
import { PlaylistActions } from '../../Playlists/components/PlaylistActions';

type PlaylistDetailActionsProps = {
  playlistId: string;
  tracks: Track[];
};

export const PlaylistDetailActions: FC<PlaylistDetailActionsProps> = ({
  playlistId,
  tracks,
}) => {
  const { t } = useTranslation('playlists');
  const navigate = useNavigate();
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist);
  const importPlaylist = usePlaylistStore((state) => state.importPlaylist);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { exportAsJson } = usePlaylistExport(playlistId);

  const handleDelete = async () => {
    await deletePlaylist(playlistId);
    setIsDeleteDialogOpen(false);
    navigate({ to: '/playlists' });
  };

  const handleClone = async () => {
    const playlistState = usePlaylistStore.getState();
    const current = playlistState.playlists.get(playlistId);
    if (current) {
      const cloneData: Playlist = {
        ...current,
        name: `${current.name} (Copia)`,
      };
      const newId = await importPlaylist(cloneData);
      toast.success('Playlist clonada con éxito en tu dispositivo');
      navigate({
        to: '/playlists/$playlistId',
        params: { playlistId: newId },
      });
    }
  };

  return (
    <>
      <PlaylistActions
        tracks={tracks}
        menuItems={
          <>
            <Popover.Item
              icon={<CopyIcon size={16} />}
              onClick={handleClone}
              data-testid="clone-playlist-action"
            >
              Clonar en mi dispositivo
            </Popover.Item>
            <Popover.Item
              icon={<ShareIcon size={16} />}
              onClick={exportAsJson}
              data-testid="export-json-action"
            >
              {t('exportJson')}
            </Popover.Item>
            <Popover.Item
              intent="danger"
              icon={<Trash2Icon size={16} />}
              onClick={() => setIsDeleteDialogOpen(true)}
              data-testid="delete-playlist-action"
            >
              {t('delete')}
            </Popover.Item>
          </>
        }
      />
      <Dialog.Root
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        <Dialog.Title>{t('delete')}</Dialog.Title>
        <Dialog.Description>{t('deleteConfirm')}</Dialog.Description>
        <Dialog.Actions>
          <Dialog.Close>{t('common:actions.cancel')}</Dialog.Close>
          <Button intent="danger" onClick={handleDelete}>
            {t('common:actions.delete')}
          </Button>
        </Dialog.Actions>
      </Dialog.Root>
    </>
  );
};
