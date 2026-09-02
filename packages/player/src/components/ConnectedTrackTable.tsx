import { useNavigate } from '@tanstack/react-router';
import { FC } from 'react';

import type { Track } from '@nuclearplayer/model';
import {
  TrackTable,
  TrackTableActions,
  TrackTableProps,
} from '@nuclearplayer/ui';

import { useQueueActions } from '../hooks/useQueueActions';
import { useTrackActions } from '../hooks/useTrackActions';
import { useTrackTableLabels } from '../hooks/useTrackTableLabels';
import { useProvidersStore } from '../stores/providersStore';
import { ConnectedTrackContextMenu } from './ConnectedTrackContextMenu';

type ConnectedTrackTableProps = Omit<
  TrackTableProps<Track>,
  'actions' | 'meta' | 'labels'
> & {
  actions?: Pick<TrackTableActions<Track>, 'onRemove' | 'onReorder'>;
};

export const ConnectedTrackTable: FC<ConnectedTrackTableProps> = (props) => {
  const { actions: externalActions, ...restProps } = props;
  const trackActions = useTrackActions();
  const queueActions = useQueueActions();
  const labels = useTrackTableLabels();
  const navigate = useNavigate();

  return (
    <TrackTable
      {...restProps}
      labels={labels}
      display={{
        displayFavorite: true,
        ...restProps.display,
      }}
      actions={{
        onAddToQueue: trackActions.addToQueue,
        onPlayNow: (track) => {
          if (restProps.tracks && restProps.tracks.length > 0) {
            const trackIndex = restProps.tracks.findIndex(
              (t) =>
                (t.source?.id && t.source?.id === track.source?.id) ||
                (t.title === track.title &&
                  t.artists?.[0]?.name === track.artists?.[0]?.name),
            );
            queueActions.clearQueue();
            queueActions.addToQueue(restProps.tracks);
            if (trackIndex > 0) {
              queueActions.goToIndex(trackIndex);
            }
          } else {
            trackActions.playNow(track);
          }
        },
        onPlayNext: trackActions.addNext,
        onToggleFavorite: trackActions.toggleFavorite,
        onRemove: externalActions?.onRemove,
        onReorder: externalActions?.onReorder,
        onPlayAll: () => {
          queueActions.clearQueue();
          queueActions.addToQueue(restProps.tracks);
        },
        onAddAllToQueue: () => {
          queueActions.addToQueue(restProps.tracks);
        },
        onArtistClick: (artistName) => {
          const activeMetadata = useProvidersStore.getState().getActive('metadata') ?? 'spotify';
          void navigate({
            to: `/artist/${activeMetadata}/${encodeURIComponent(artistName)}`,
          });
        },
        onAlbumClick: (albumTitle) => {
          const activeMetadata = useProvidersStore.getState().getActive('metadata') ?? 'spotify';
          void navigate({
            to: `/album/${activeMetadata}/${encodeURIComponent(albumTitle)}`,
          });
        },
      }}
      meta={{
        isTrackFavorite: trackActions.isFavorite,
        ContextMenuWrapper: ConnectedTrackContextMenu,
      }}
    />
  );
};
