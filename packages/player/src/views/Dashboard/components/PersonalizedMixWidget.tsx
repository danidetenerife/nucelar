import { useQuery } from '@tanstack/react-query';
import { SparklesIcon } from 'lucide-react';
import { FC } from 'react';

import type { Track, TrackRef } from '@nuclearplayer/model';
import type { MetadataProvider } from '@nuclearplayer/plugin-sdk';
import { Badge, Loader } from '@nuclearplayer/ui';

import { ConnectedTrackTable } from '../../../components/ConnectedTrackTable';
import { useProviders } from '../../../hooks/useProviders';
import { discoveryHost } from '../../../services/discoveryHost';
import {
  personalizationEngine,
  type ArtistScore,
} from '../../../services/personalizationEngine';
import { providersHost } from '../../../services/providersHost';

type TaggedCandidate = {
  track: Track;
  source: 'topTracks' | 'related' | 'radio' | 'search';
};

const trackRefToTrack = (ref: TrackRef): Track => ({
  title: ref.title,
  artists: ref.artists.map((artist) => ({
    name: artist.name,
    roles: [],
    source: artist.source,
  })),
  artwork: ref.artwork,
  source: ref.source,
});

const fetchTopTracksForArtists = async (
  provider: MetadataProvider,
  artists: ArtistScore[],
  limit: number,
): Promise<TaggedCandidate[]> => {
  const candidates: TaggedCandidate[] = [];

  for (const artist of artists.slice(0, limit)) {
    try {
      const artistUri = artist.spotifyUri;
      if (!artistUri || !provider.fetchArtistTopTracks) continue;

      const topTracks = await provider.fetchArtistTopTracks(artistUri);
      for (const trackRef of topTracks.slice(0, 5)) {
        candidates.push({
          track: trackRefToTrack(trackRef),
          source: 'topTracks',
        });
      }
    } catch {
      // ignore
    }
  }

  return candidates;
};

const fetchRelatedArtistTracks = async (
  provider: MetadataProvider,
  artists: ArtistScore[],
  limit: number,
): Promise<TaggedCandidate[]> => {
  const candidates: TaggedCandidate[] = [];
  const seenArtistUris = new Set<string>();

  for (const artist of artists.slice(0, limit)) {
    try {
      const artistUri = artist.spotifyUri;
      if (!artistUri || !provider.fetchArtistRelatedArtists || !provider.fetchArtistTopTracks) continue;

      const relatedArtists = await provider.fetchArtistRelatedArtists(artistUri);

      for (const relatedArtist of relatedArtists.slice(0, 3)) {
        const relatedUri = relatedArtist.source?.id;
        if (!relatedUri || seenArtistUris.has(relatedUri)) continue;
        seenArtistUris.add(relatedUri);

        try {
          const topTracks = await provider.fetchArtistTopTracks(relatedUri);
          for (const trackRef of topTracks.slice(0, 3)) {
            candidates.push({
              track: trackRefToTrack(trackRef),
              source: 'related',
            });
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return candidates;
};

const fetchRadioRecommendations = async (
  seedTracks: Track[],
): Promise<TaggedCandidate[]> => {
  try {
    const activeDiscoveryId = providersHost.getActive('discovery');
    if (!activeDiscoveryId) return [];

    const recommendations = await discoveryHost.getRecommendations(
      seedTracks.slice(0, 5),
      { variety: 0.7, limit: 20 },
    );

    return recommendations.map((track) => ({
      track,
      source: 'radio' as const,
    }));
  } catch {
    return [];
  }
};

const fetchSearchFallback = async (
  provider: MetadataProvider,
  topArtists: ArtistScore[],
): Promise<TaggedCandidate[]> => {
  const candidates: TaggedCandidate[] = [];
  const queries =
    topArtists.length > 0
      ? topArtists.slice(0, 3).map((artist) => artist.name)
      : ['Pop Hits', 'Rock Classics', 'Reggaeton Mix', 'Electronic Music'];

  for (const query of queries) {
    try {
      if (!provider.search) continue;
      const results = await provider.search({
        query,
        types: ['tracks'],
      });
      if (results.tracks && Array.isArray(results.tracks)) {
        for (const track of results.tracks.slice(0, 6)) {
          candidates.push({ track, source: 'search' });
        }
      }
    } catch {
      // ignore
    }
  }

  return candidates;
};

export const PersonalizedMixWidget: FC = () => {
  const metadataProviders = useProviders('metadata') as MetadataProvider[];
  const activeProviderId = metadataProviders[0]?.id ?? null;

  const { data: tracks, isLoading } = useQuery<Track[]>({
    queryKey: ['dashboard', 'personalized-mix-v2', activeProviderId],
    enabled: metadataProviders.length > 0,
    queryFn: async () => {
      const topArtists = await personalizationEngine.getTopArtists();
      const seedTracks = await personalizationEngine.getSeedTracks(5);
      const metadataProvider = metadataProviders[0];

      const hasSpotifyCapabilities =
        metadataProvider?.fetchArtistTopTracks &&
        metadataProvider?.fetchArtistRelatedArtists;

      const artistsWithUris = topArtists.filter(
        (artist) => artist.spotifyUri,
      );

      const candidateSources = await Promise.allSettled([
        hasSpotifyCapabilities && artistsWithUris.length > 0
          ? fetchTopTracksForArtists(metadataProvider, artistsWithUris, 6)
          : Promise.resolve([]),

        hasSpotifyCapabilities && artistsWithUris.length > 0
          ? fetchRelatedArtistTracks(metadataProvider, artistsWithUris, 4)
          : Promise.resolve([]),

        seedTracks.length > 0
          ? fetchRadioRecommendations(seedTracks)
          : Promise.resolve([]),

        fetchSearchFallback(metadataProvider, topArtists),
      ]);

      const allCandidates: TaggedCandidate[] = candidateSources.flatMap(
        (result) => (result.status === 'fulfilled' ? result.value : []),
      );

      if (allCandidates.length === 0) {
        return [];
      }

      return personalizationEngine.scoreAndRankTracks(
        allCandidates,
        topArtists,
      );
    },
    staleTime: 60 * 1000,
  });

  return (
    <div
      data-testid="dashboard-personalized-mix"
      className="flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="text-primary size-5" />
          <h2 className="text-lg font-bold">Recomendado para ti</h2>
        </div>
        <Badge variant="pill" className="text-xs">
          Algoritmo Adaptativo
        </Badge>
      </div>
      <p className="text-foreground-secondary text-xs">
        Música personalizada que aprende automáticamente de tus reproducciones y
        favoritos.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader data-testid="dashboard-personalized-loader" size="lg" />
        </div>
      ) : (
        <ConnectedTrackTable
          tracks={tracks || []}
          features={{ filterable: true, playAll: true, addAllToQueue: true }}
          display={{ displayDuration: false }}
        />
      )}
    </div>
  );
};
