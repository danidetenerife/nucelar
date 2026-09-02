import type { Track } from '@nuclearplayer/model';
import { pickArtwork } from '@nuclearplayer/model';

import { useHistoryStore } from '../../stores/historyStore';
import { getSetting } from '../../stores/settingsStore';
import { useSoundStore } from '../../stores/soundStore';
import { secondsToMs } from '../../utils/time';
import { eventBus } from '../eventBus';
import { Logger } from '../logger';
import type { PlayEventKind, TrackSnapshot } from '../tauri/bindings';
import { commands } from '../tauri/bindings';
import { isTauriEnvironment } from '../universalStore';

const HISTORY_ENABLED_SETTING = 'core.history.enabled';
const ARTWORK_TARGET_PX = 256;

type PlayEventFields = {
  kind: PlayEventKind;
  positionMs: number;
  seekToMs?: number;
  snapshot?: TrackSnapshot;
};

const isEnabled = () =>
  isTauriEnvironment() && getSetting(HISTORY_ENABLED_SETTING) !== false;

const currentPositionMs = () => secondsToMs(useSoundStore.getState().seek);

const buildSnapshot = (track: Track): TrackSnapshot => ({
  title: track.title,
  artists: track.artists.map((artist) => artist.name),
  albumTitle: track.album?.title ?? null,
  durationMs: track.durationMs ?? null,
  artworkUrl:
    pickArtwork(track.artwork, 'thumbnail', ARTWORK_TARGET_PX)?.url ?? null,
  provider: track.source.provider,
  providerId: track.source.id,
});

const record = async (playId: string, fields: PlayEventFields) => {
  if (!isTauriEnvironment()) {
    return;
  }
  try {
    const result = await commands.historyRecordEvent({
      playId,
      kind: fields.kind,
      at: Date.now(),
      positionMs: fields.positionMs,
      seekToMs: fields.seekToMs ?? null,
      snapshot: fields.snapshot ?? null,
    });

    if (result.status === 'error') {
      Logger.history.error(
        `Failed to record ${fields.kind} event: ${result.error}`,
      );
    }
  } catch (error) {
    Logger.history.warn(`History record skipped: ${error}`);
  }
};

const recordStarted = async (track: Track) => {

  if (!isEnabled()) {
    return;
  }

  await record(useHistoryStore.getState().beginPlay(), {
    kind: 'started',
    positionMs: 0,
    snapshot: buildSnapshot(track),
  });
};

const recordDuringPlay = async (fields: PlayEventFields) => {
  const { currentPlayId } = useHistoryStore.getState();
  if (!isEnabled() || currentPlayId === null) {
    return;
  }

  await record(currentPlayId, fields);
};

const recordTerminal = async (fields: PlayEventFields) => {
  const { currentPlayId, clearPlay } = useHistoryStore.getState();
  if (!isEnabled() || currentPlayId === null) {
    return;
  }

  clearPlay();
  await record(currentPlayId, fields);
};

export const initHistoryService = () => {
  const unsubscribes = [
    eventBus.on('trackStarted', recordStarted),
    eventBus.on('trackFinished', () =>
      recordTerminal({ kind: 'finished', positionMs: currentPositionMs() }),
    ),
    eventBus.on('playbackSkipped', ({ positionMs }) =>
      recordTerminal({ kind: 'skipped', positionMs }),
    ),
    eventBus.on('playbackStopped', ({ positionMs }) =>
      recordTerminal({ kind: 'stopped', positionMs }),
    ),
    eventBus.on('playbackSeeked', ({ toMs }) =>
      recordDuringPlay({
        kind: 'seeked',
        positionMs: currentPositionMs(),
        seekToMs: toMs,
      }),
    ),
    eventBus.on('playbackPaused', () =>
      recordDuringPlay({
        kind: 'paused',
        positionMs: currentPositionMs(),
      }),
    ),
    eventBus.on('playbackResumed', () =>
      recordDuringPlay({
        kind: 'resumed',
        positionMs: currentPositionMs(),
      }),
    ),
  ];

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
};
