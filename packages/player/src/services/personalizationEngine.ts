import type { Track } from '@nuclearplayer/model';

import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { eventBus } from './eventBus';
import { createUniversalStore } from './universalStore';

const USER_PROFILE_STORE = 'user_profile.json';
const profileStore = createUniversalStore(USER_PROFILE_STORE);

const MAX_RECORDS = 1000;
const SKIP_THRESHOLD_MS = 30_000;
const RECENCY_HALF_LIFE_DAYS = 21;
const MAX_TRACKS_PER_ARTIST = 3;

export type UserListenRecord = {
  trackId: string;
  title: string;
  artist: string;
  playCount: number;
  skipCount: number;
  totalListenMs: number;
  durationMs: number;
  lastPlayedAt: number;
  firstPlayedAt: number;
};

export type ArtistScore = {
  name: string;
  score: number;
  spotifyUri?: string;
};

const exponentialDecay = (daysAgo: number): number =>
  Math.exp((-Math.LN2 * daysAgo) / RECENCY_HALF_LIFE_DAYS);

const completionRate = (record: UserListenRecord): number => {
  if (record.durationMs <= 0 || record.playCount <= 0) return 0.5;
  const totalExpected = record.playCount * record.durationMs;
  return Math.min(1, record.totalListenMs / totalExpected);
};

const loyaltyBonus = (record: UserListenRecord): number => {
  const daysSinceFirst = Math.max(
    0,
    (Date.now() - record.firstPlayedAt) / (1000 * 60 * 60 * 24),
  );
  return Math.log2(1 + daysSinceFirst);
};

const migrateRecord = (raw: Record<string, unknown>): UserListenRecord => ({
  trackId: (raw.trackId as string) ?? '',
  title: (raw.title as string) ?? '',
  artist: (raw.artist as string) ?? 'Unknown',
  playCount: (raw.playCount as number) ?? 1,
  skipCount: (raw.skipCount as number) ?? 0,
  totalListenMs: (raw.totalListenMs as number) ?? ((raw.playCount as number) ?? 1) * ((raw.durationMs as number) ?? 180_000) * 0.7,
  durationMs: (raw.durationMs as number) ?? 180_000,
  lastPlayedAt: (raw.lastPlayedAt as number) ?? Date.now(),
  firstPlayedAt: (raw.firstPlayedAt as number) ?? (raw.lastPlayedAt as number) ?? Date.now(),
});

export class PersonalizationEngine {
  private static instance: PersonalizationEngine;
  private lastSkippedTrackId: string | null = null;

  constructor() {
    eventBus.on('trackStarted', async (track) => {
      if (track) {
        this.lastSkippedTrackId = null;
      }
    });

    eventBus.on('trackFinished', async (track) => {
      if (track) {
        await this.recordPlay(track, true);
      }
    });

    eventBus.on('playbackSkipped', async ({ positionMs }) => {
      if (positionMs < SKIP_THRESHOLD_MS) {
        this.lastSkippedTrackId = 'pending-skip';
      }
    });

    eventBus.on('trackStarted', async (track) => {
      if (track && this.lastSkippedTrackId === 'pending-skip') {
        this.lastSkippedTrackId = null;
      }
    });
  }

  static getInstance(): PersonalizationEngine {
    if (!this.instance) {
      this.instance = new PersonalizationEngine();
    }
    return this.instance;
  }

  async getListenRecords(): Promise<UserListenRecord[]> {
    const raw = (await profileStore.get<Record<string, unknown>[]>('listens')) || [];
    return raw.map(migrateRecord);
  }

  async mergeRemoteListens(remoteListens: UserListenRecord[]): Promise<void> {
    if (!Array.isArray(remoteListens) || remoteListens.length === 0) {
      return;
    }
    const local = await this.getListenRecords();
    const map = new Map<string, UserListenRecord>();

    for (const item of local) {
      if (item.trackId) {
        map.set(item.trackId, item);
      }
    }

    for (const item of remoteListens) {
      if (item.trackId) {
        const migrated = migrateRecord(item as unknown as Record<string, unknown>);
        if (map.has(item.trackId)) {
          const existing = map.get(item.trackId)!;
          existing.playCount = Math.max(existing.playCount, migrated.playCount);
          existing.skipCount = Math.max(existing.skipCount, migrated.skipCount);
          existing.totalListenMs = Math.max(existing.totalListenMs, migrated.totalListenMs);
          existing.lastPlayedAt = Math.max(existing.lastPlayedAt, migrated.lastPlayedAt);
          existing.firstPlayedAt = Math.min(existing.firstPlayedAt, migrated.firstPlayedAt);
        } else {
          map.set(item.trackId, migrated);
        }
      }
    }

    const merged = Array.from(map.values())
      .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
      .slice(0, MAX_RECORDS);

    await profileStore.set('listens', merged);
    await profileStore.save();
  }

  async recordPlay(track: Track, completed: boolean): Promise<void> {
    const records = await this.getListenRecords();
    const artistName = track.artists?.[0]?.name || 'Unknown';
    const trackId = track.source?.id || `${artistName}-${track.title}`;
    const trackDuration = track.durationMs ?? 180_000;

    const existingIndex = records.findIndex(
      (record) =>
        record.trackId === trackId ||
        (record.title === track.title && record.artist === artistName),
    );

    if (existingIndex >= 0) {
      const existing = records[existingIndex];
      if (completed) {
        existing.playCount += 1;
        existing.totalListenMs += trackDuration;
      } else {
        existing.skipCount += 1;
        existing.totalListenMs += Math.min(SKIP_THRESHOLD_MS, trackDuration * 0.1);
      }
      existing.lastPlayedAt = Date.now();
      existing.durationMs = trackDuration;
    } else {
      records.unshift({
        trackId,
        title: track.title,
        artist: artistName,
        playCount: completed ? 1 : 0,
        skipCount: completed ? 0 : 1,
        totalListenMs: completed ? trackDuration : Math.min(SKIP_THRESHOLD_MS, trackDuration * 0.1),
        durationMs: trackDuration,
        lastPlayedAt: Date.now(),
        firstPlayedAt: Date.now(),
      });
    }

    const trimmed = records.slice(0, MAX_RECORDS);
    await profileStore.set('listens', trimmed);
    await profileStore.save();
  }

  async getTopArtists(): Promise<ArtistScore[]> {
    const listens = await this.getListenRecords();
    const favState = useFavoritesStore.getState();
    const playlistState = usePlaylistStore.getState();

    const artistScores: Record<string, ArtistScore> = {};

    const ensureArtist = (name: string): ArtistScore => {
      if (!artistScores[name]) {
        artistScores[name] = { name, score: 0 };
      }
      return artistScores[name];
    };

    const now = Date.now();

    for (const record of listens) {
      if (!record.artist || record.artist === 'Unknown') continue;

      const daysAgo = Math.max(0, (now - record.lastPlayedAt) / (1000 * 60 * 60 * 24));
      const recencyWeight = exponentialDecay(daysAgo);
      const completion = completionRate(record);
      const loyalty = loyaltyBonus(record);

      const score =
        record.playCount *
        Math.pow(completion, 2) *
        recencyWeight *
        (1 + loyalty * 0.3);

      const skipPenalty = record.skipCount > 0
        ? Math.max(0.3, 1 - (record.skipCount / (record.playCount + record.skipCount)) * 0.5)
        : 1;

      ensureArtist(record.artist).score += score * skipPenalty;
    }

    for (const favTrack of favState.tracks) {
      const artist = favTrack.ref.artists?.[0]?.name;
      if (artist) {
        const daysAgo = favTrack.addedAtIso
          ? Math.max(0, (now - new Date(favTrack.addedAtIso).getTime()) / (1000 * 60 * 60 * 24))
          : 30;
        ensureArtist(artist).score += 15 * exponentialDecay(daysAgo);
      }
    }

    for (const favArtist of favState.artists) {
      const artist = favArtist.ref.name;
      if (artist) {
        const entry = ensureArtist(artist);
        entry.score += 25;
        if (favArtist.ref.source?.provider === 'spotify') {
          entry.spotifyUri = favArtist.ref.source.id;
        }
      }
    }

    playlistState.playlists.forEach((playlist) => {
      for (const item of playlist.items || []) {
        const artist = item.track?.artists?.[0]?.name;
        if (artist) {
          const entry = ensureArtist(artist);
          entry.score += 5;
          const artistSource = item.track?.artists?.[0]?.source;
          if (artistSource?.provider === 'spotify' && !entry.spotifyUri) {
            entry.spotifyUri = artistSource.id;
          }
        }
      }
    });

    return Object.values(artistScores)
      .sort((a, b) => b.score - a.score);
  }

  async getTopArtistNames(): Promise<string[]> {
    const scored = await this.getTopArtists();
    return scored.map((entry) => entry.name);
  }

  async getSeedTracks(limit = 10): Promise<Track[]> {
    const listens = await this.getListenRecords();

    return listens
      .filter((record) => record.playCount > 0 && completionRate(record) > 0.5)
      .sort((a, b) => {
        const aScore = a.playCount * completionRate(a) * exponentialDecay(
          Math.max(0, (Date.now() - a.lastPlayedAt) / (1000 * 60 * 60 * 24)),
        );
        const bScore = b.playCount * completionRate(b) * exponentialDecay(
          Math.max(0, (Date.now() - b.lastPlayedAt) / (1000 * 60 * 60 * 24)),
        );
        return bScore - aScore;
      })
      .slice(0, limit)
      .map((record) => ({
        title: record.title,
        artists: [{ name: record.artist, roles: [], source: { provider: 'unknown', id: record.trackId } }],
        source: { provider: 'unknown', id: record.trackId },
        artwork: undefined,
      }));
  }

  scoreAndRankTracks(
    candidates: Array<{ track: Track; source: 'topTracks' | 'related' | 'radio' | 'search' }>,
    topArtists: ArtistScore[],
  ): Track[] {
    const artistAffinityMap = new Map<string, number>();
    const maxScore = topArtists[0]?.score ?? 1;
    for (const artist of topArtists) {
      artistAffinityMap.set(
        artist.name.toLowerCase(),
        artist.score / maxScore,
      );
    }

    const sourceWeights: Record<string, number> = {
      related: 1.0,
      radio: 0.85,
      topTracks: 0.7,
      search: 0.4,
    };

    const seenIds = new Set<string>();
    const artistTrackCount = new Map<string, number>();
    const scored: Array<{ track: Track; score: number }> = [];

    for (const candidate of candidates) {
      const trackId =
        candidate.track.source?.id ||
        `${candidate.track.artists?.[0]?.name}-${candidate.track.title}`;
      if (seenIds.has(trackId)) continue;
      seenIds.add(trackId);

      const artistName = (candidate.track.artists?.[0]?.name || '').toLowerCase();
      const currentCount = artistTrackCount.get(artistName) ?? 0;

      if (currentCount >= MAX_TRACKS_PER_ARTIST) continue;
      artistTrackCount.set(artistName, currentCount + 1);

      const affinity = artistAffinityMap.get(artistName) ?? 0;
      const sourceBonus = sourceWeights[candidate.source] ?? 0.5;
      const diversityBonus = 1 - (currentCount / MAX_TRACKS_PER_ARTIST) * 0.5;
      const freshnessNoise = 0.8 + Math.random() * 0.4;

      const finalScore =
        affinity * 0.40 +
        sourceBonus * 0.25 +
        diversityBonus * 0.20 +
        freshnessNoise * 0.15;

      scored.push({ track: candidate.track, score: finalScore });
    }

    scored.sort((a, b) => b.score - a.score);

    return this.interleave(scored.map((entry) => entry.track));
  }

  private interleave(tracks: Track[]): Track[] {
    if (tracks.length <= 4) return tracks;

    const result: Track[] = [];
    const byArtist = new Map<string, Track[]>();

    for (const track of tracks) {
      const artist = (track.artists?.[0]?.name || 'unknown').toLowerCase();
      if (!byArtist.has(artist)) {
        byArtist.set(artist, []);
      }
      byArtist.get(artist)!.push(track);
    }

    const queues = Array.from(byArtist.values())
      .sort((a, b) => b.length - a.length);

    let queueIndex = 0;
    while (result.length < tracks.length) {
      let added = false;
      const startIndex = queueIndex;
      do {
        const queue = queues[queueIndex % queues.length];
        if (queue && queue.length > 0) {
          result.push(queue.shift()!);
          added = true;
        }
        queueIndex = (queueIndex + 1) % queues.length;
      } while (!added && queueIndex !== startIndex);

      if (!added) break;
    }

    return result;
  }
}

export const personalizationEngine = PersonalizationEngine.getInstance();
