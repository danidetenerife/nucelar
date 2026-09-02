import { useNavigate, useParams } from '@tanstack/react-router';
import { FC, useEffect, useMemo, useState } from 'react';

import type { MetadataProvider } from '@nuclearplayer/plugin-sdk';
import { EmptyState, ScrollableArea } from '@nuclearplayer/ui';
import { Loader2, Radio } from 'lucide-react';

import { useProviders } from '../../hooks/useProviders';
import { providersHost } from '../../services/providersHost';
import { useProvidersStore } from '../../stores/providersStore';
import { useStartupStore } from '../../stores/startupStore';
import { ARTIST_WIDGETS, groupWidgets } from './artistWidgets';

type ArtistProps = Record<string, never>;

const normalizeProviderId = (id: string): string => {
  if (id === 'youtube' || id === 'nuclear-plugin-youtube-music') {
    return 'youtube-music';
  }
  if (id === 'nuclear-plugin-something') {
    return 'spotify';
  }
  return id;
};

const isYouTubeChannelId = (id: string): boolean => {
  return id.startsWith('UC') || id.startsWith('FEmusic_artist_');
};

const isSpotifyUri = (id: string): boolean => {
  return id.startsWith('spotify:artist:') || id.includes(':');
};

export const Artist: FC<ArtistProps> = () => {
  const { providerId: rawProviderId, artistId } = useParams({
    from: '/artist/$providerId/$artistId',
  });
  const navigate = useNavigate();
  const metadataProviders = useProviders('metadata') as MetadataProvider[];
  const activeMetadataProviderId = useProvidersStore((state) =>
    state.getActive('metadata'),
  );
  const isStartingUp = useStartupStore((state) => state.isStartingUp);

  const providerId = normalizeProviderId(rawProviderId);
  const decodedArtistId = decodeURIComponent(artistId);

  const provider = useMemo(
    () =>
      metadataProviders.find((p) => p.id === providerId) ??
      providersHost.get<MetadataProvider>(providerId, 'metadata'),
    [providerId, metadataProviders],
  );

  const capabilities = new Set(provider?.artistMetadataCapabilities ?? []);
  const activeWidgets = ARTIST_WIDGETS.filter((widget) =>
    capabilities.has(widget.capability),
  );
  const widgetGroups = groupWidgets(activeWidgets);

  const [capabilitiesTimedOut, setCapabilitiesTimedOut] = useState(false);

  useEffect(() => {
    if (!provider || activeWidgets.length > 0) {
      setCapabilitiesTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setCapabilitiesTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [provider, activeWidgets.length]);

  useEffect(() => {
    if (metadataProviders.length === 0) {
      return;
    }

    // Case 1: Channel ID on a non-YouTube provider -> redirect to youtube-music
    if (isYouTubeChannelId(decodedArtistId) && providerId !== 'youtube-music') {
      const ytProvider = metadataProviders.find((p) => p.id === 'youtube-music');
      if (ytProvider) {
        void navigate({
          to: `/artist/youtube-music/${encodeURIComponent(decodedArtistId)}`,
          replace: true,
        });
        return;
      }
    }

    // Case 2: Spotify URI on a non-Spotify provider -> redirect to spotify
    if (isSpotifyUri(decodedArtistId) && providerId !== 'spotify') {
      const spotifyProvider = metadataProviders.find((p) => p.id === 'spotify');
      if (spotifyProvider) {
        void navigate({
          to: `/artist/spotify/${encodeURIComponent(decodedArtistId)}`,
          replace: true,
        });
        return;
      }
    }

    // Case 3: Provider not found at all -> redirect to active metadata provider
    if (!provider) {
      const targetId =
        activeMetadataProviderId ?? metadataProviders[0]?.id ?? 'spotify';
      const targetProvider =
        metadataProviders.find((p) => p.id === targetId) ??
        providersHost.get<MetadataProvider>(targetId, 'metadata');

      if (targetProvider) {
        void navigate({
          to: `/artist/${targetProvider.id}/${encodeURIComponent(decodedArtistId)}`,
          replace: true,
        });
      }
    }
  }, [
    provider,
    providerId,
    decodedArtistId,
    activeMetadataProviderId,
    metadataProviders,
    navigate,
  ]);

  const isWaiting =
    isStartingUp ||
    (!provider && metadataProviders.length > 0) ||
    metadataProviders.length === 0;

  if (isWaiting) {
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
          title={
            metadataProviders.length === 0
              ? 'Sin proveedor de metadatos'
              : 'Información no disponible'
          }
          description={
            metadataProviders.length === 0
              ? 'Instala un plugin de metadatos en Ajustes → Fuentes para ver la ficha del artista.'
              : `No se encontró información para "${decodedArtistId}".`
          }
          className="flex-1"
        />
      </ScrollableArea>
    );
  }

  if (activeWidgets.length === 0) {
    if (capabilitiesTimedOut) {
      return (
        <ScrollableArea className="bg-background flex flex-col items-center justify-center">
          <EmptyState
            icon={<Radio size={48} />}
            title="Información no disponible"
            description={`El plugin "${providerId}" no responde. Comprueba la conexión e intenta de nuevo.`}
            className="flex-1"
          />
        </ScrollableArea>
      );
    }
    return (
      <ScrollableArea className="bg-background flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-primary opacity-60" />
      </ScrollableArea>
    );
  }

  return (
    <ScrollableArea className="bg-background">
      {widgetGroups.map((group) => {
        if (group.entries.length === 1) {
          const SingleWidget = group.entries[0].component;
          return (
            <SingleWidget
              key={group.key}
              providerId={providerId}
              artistId={artistId}
            />
          );
        }

        return (
          <div
            key={group.key}
            className="mx-4 mb-4 flex flex-col gap-4 md:flex-row"
          >
            {group.entries.map(({ capability, component: Widget, width }) => (
              <div key={capability} className={width}>
                <Widget providerId={providerId} artistId={artistId} />
              </div>
            ))}
          </div>
        );
      })}
    </ScrollableArea>
  );
};
