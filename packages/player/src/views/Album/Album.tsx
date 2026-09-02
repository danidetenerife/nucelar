import { useNavigate, useParams } from '@tanstack/react-router';
import { FC, useEffect, useMemo, useState } from 'react';

import type { MetadataProvider } from '@nuclearplayer/plugin-sdk';
import { EmptyState, ScrollableArea } from '@nuclearplayer/ui';
import { Loader2, Radio } from 'lucide-react';

import { useProviders } from '../../hooks/useProviders';
import { providersHost } from '../../services/providersHost';
import { useProvidersStore } from '../../stores/providersStore';
import { useStartupStore } from '../../stores/startupStore';
import { AlbumHeader } from './components/AlbumHeader';
import { AlbumTrackList } from './components/AlbumTrackList';

type AlbumProps = Record<string, never>;

export const Album: FC<AlbumProps> = () => {
  const { providerId, albumId } = useParams({
    from: '/album/$providerId/$albumId',
  });
  const navigate = useNavigate();
  const metadataProviders = useProviders('metadata');
  const activeMetadataProviderId = useProvidersStore((state) =>
    state.getActive('metadata'),
  );
  const isStartingUp = useStartupStore((state) => state.isStartingUp);

  const provider = useMemo(
    () => providersHost.get<MetadataProvider>(providerId, 'metadata'),
    [providerId],
  );

  const [redirecting, setRedirecting] = useState(false);
  const [redirectFailed, setRedirectFailed] = useState(false);

  useEffect(() => {
    if (provider) {
      setRedirecting(false);
      return;
    }
    if (metadataProviders.length === 0) {
      return;
    }

    const firstAvailableId = metadataProviders[0]?.id;
    const targetProviderId = activeMetadataProviderId ?? firstAvailableId;
    if (!targetProviderId || providerId === targetProviderId) {
      setRedirecting(false);
      return;
    }

    const targetProvider = providersHost.get<MetadataProvider>(
      targetProviderId,
      'metadata',
    );
    if (!targetProvider?.searchAlbums) {
      setRedirecting(false);
      return;
    }

    setRedirecting(true);
    setRedirectFailed(false);

    const albumName = decodeURIComponent(albumId);
    targetProvider
      .searchAlbums({ query: albumName, limit: 1 })
      .then((results) => {
        const first = results?.[0];
        if (first?.source?.id) {
          void navigate({
            to: `/album/${targetProviderId}/${encodeURIComponent(first.source.id)}`,
            replace: true,
          });
        } else {
          setRedirecting(false);
          setRedirectFailed(true);
        }
      })
      .catch(() => {
        setRedirecting(false);
        setRedirectFailed(true);
      });
  }, [
    provider,
    providerId,
    albumId,
    activeMetadataProviderId,
    metadataProviders,
    navigate,
  ]);

  const isWaitingForProviders = !provider && !redirectFailed && (isStartingUp || redirecting || metadataProviders.length === 0);

  if (isWaitingForProviders) {
    return (
      <ScrollableArea className="bg-background flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-primary opacity-60" />
      </ScrollableArea>
    );
  }

  if (!provider) {
    return (
      <ScrollableArea className="bg-background flex flex-col items-center justify-center">
        <EmptyState
          icon={<Radio size={48} />}
          title="Información no disponible"
          description={`No se encontró información para "${decodeURIComponent(albumId)}".`}
          className="flex-1"
        />
      </ScrollableArea>
    );
  }

  return (
    <ScrollableArea className="bg-background" data-testid="album-view">
      <AlbumHeader providerId={providerId} albumId={albumId} />
      <div className="h-full p-6">
        <AlbumTrackList providerId={providerId} albumId={albumId} />
      </div>
    </ScrollableArea>
  );
};
