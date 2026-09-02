import { RefObject, useEffect, useRef } from 'react';

import { SoundStatus } from '../types';

const HAVE_CURRENT_DATA = 2;

const isReadyToPlay = (audio: HTMLAudioElement): boolean =>
  audio.readyState >= HAVE_CURRENT_DATA;

export const usePlaybackStatus = (
  audioRef: RefObject<HTMLAudioElement | null>,
  status: SoundStatus,
  srcUrl: string,
  onError?: (error: Error) => void,
) => {
  const activeSrcRef = useRef(srcUrl);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const srcChanged = srcUrl !== activeSrcRef.current;

    const tryPlay = () => {
      if (!isReadyToPlay(audio)) {
        return;
      }
      if (!audio.paused) {
        return;
      }
      activeSrcRef.current = srcUrl;
      audio.play().then(undefined, (err: DOMException) => {
        if (err.name === 'AbortError') {
          return;
        }
        onError?.(err);
      });
    };

    switch (status) {
      case 'playing': {
        if (!srcChanged || isReadyToPlay(audio)) {
          tryPlay();
        }
        const onCanPlay = () => tryPlay();
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('loadeddata', onCanPlay);
        return () => {
          audio.removeEventListener('canplay', onCanPlay);
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('loadeddata', onCanPlay);
        };
      }
      case 'paused': {
        audio.pause();
        return;
      }
      case 'stopped': {
        audio.pause();
        audio.currentTime = 0;
        return;
      }
    }
  }, [status, srcUrl, audioRef, onError]);

  // Keep playback running through screen off, backgrounding, and foregrounding
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleUnintendedPause = () => {
      if (status === 'playing' && audio.paused && isReadyToPlay(audio)) {
        audio.play().catch(() => {});
      }
    };

    const handleKeepPlaying = () => {
      if (status === 'playing' && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('pause', handleUnintendedPause);
    document.addEventListener('visibilitychange', handleKeepPlaying);
    window.addEventListener('blur', handleKeepPlaying);
    window.addEventListener('focus', handleKeepPlaying);

    return () => {
      audio.removeEventListener('pause', handleUnintendedPause);
      document.removeEventListener('visibilitychange', handleKeepPlaying);
      window.removeEventListener('blur', handleKeepPlaying);
      window.removeEventListener('focus', handleKeepPlaying);
    };
  }, [audioRef, status]);
};
