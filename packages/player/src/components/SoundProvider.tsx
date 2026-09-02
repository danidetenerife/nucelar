import type { FC, PropsWithChildren } from 'react';
import { useCallback, useEffect } from 'react';

import { LoggerProvider, Sound, SoundError } from '@nuclearplayer/hifi';
import type { TFunction } from '@nuclearplayer/i18n';
import { useTranslation } from '@nuclearplayer/i18n';

import { useCoreSetting } from '../hooks/useCoreSetting';
import { eventBus } from '../services/eventBus';
import { Logger } from '../services/logger';
import { playbackManager } from '../services/playback';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { errorMessage } from '../utils/errorMessage';
import { isCapacitorEnvironment } from '../services/universalStore';

const describePlaybackError = (error: Error, t: TFunction): string => {
  if (error instanceof SoundError) {
    return t(`errors.hifi.${error.code}`, { details: error.details });
  }
  return errorMessage(error);
};

export const SoundProvider: FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation('streaming');
  const { src, status, seek } = useSoundStore();
  const [crossfadeMs] = useCoreSetting<number>('playback.crossfadeMs');
  const [showVideo, setShowVideo] =
    useCoreSetting<boolean>('playback.showVideo');
  const preload: HTMLAudioElement['preload'] = 'auto';
  const crossOrigin = undefined;
  const [volume01] = useCoreSetting<number>('playback.volume');
  const [muted] = useCoreSetting<boolean>('playback.muted');
  const volumePercent = muted ? 0 : Math.round((volume01 ?? 1) * 100);

  useEffect(() => {
    LoggerProvider.init(Logger.streaming);
  }, []);

  useEffect(() => {
    if (crossfadeMs !== undefined) {
      useSoundStore.getState().setCrossfadeMs(crossfadeMs);
    }
  }, [crossfadeMs]);

  const handleTimeUpdate = useCallback(
    ({ position, duration }: { position: number; duration: number }) => {
      useSoundStore.getState().updatePlayback(position, duration);
    },
    [],
  );

  const handleEnd = useCallback(() => {
    playbackManager.finishTrack();
  }, []);

  const handleCanPlay = useCallback(() => {
    const currentItem = useQueueStore.getState().getCurrentItem();
    if (currentItem) {
      useQueueStore
        .getState()
        .updateItemState(currentItem.id, { status: 'success' });
    }
  }, []);

  const handleSourceInvalid = useCallback(() => {
    const currentTrack = useQueueStore.getState().getCurrentItem()?.track;
    if (currentTrack) {
      eventBus.emit('streamSourceInvalid', currentTrack);
    }
  }, []);

  const handleError = useCallback(
    (error: Error) => {
      const message = describePlaybackError(error, t);
      Logger.streaming.error(`Playback error: ${message}`);

      const currentItem = useQueueStore.getState().getCurrentItem();
      if (currentItem) {
        useQueueStore
          .getState()
          .updateItemState(currentItem.id, { status: 'error', error: message });
      }
    },
    [t],
  );

  return (
    <>
      {src && status !== 'stopped' && !isCapacitorEnvironment() && (
        <Sound
          src={src}
          status={status}
          seek={seek}
          showVideo={Boolean(showVideo)}
          onCloseVideo={() => setShowVideo(false)}
          volume={volumePercent}
          preload={preload}
          crossOrigin={crossOrigin}
          onTimeUpdate={handleTimeUpdate}
          onEnd={handleEnd}
          onCanPlay={handleCanPlay}
          onError={handleError}
          onSourceInvalid={handleSourceInvalid}
        />
      )}
      {children}
    </>
  );
};
