import { RefObject, useEffect, useRef } from 'react';

import { SoundStatus } from '../types';

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

    const tryPlay = () => {
      if (!audio.paused) {
        return;
      }
      activeSrcRef.current = srcUrl;
      audio.play().catch((err: DOMException) => {
        if (err.name === 'AbortError' || err.name === 'NotAllowedError') {
          return;
        }
        onError?.(err);
      });
    };

    switch (status) {
      case 'playing': {
        tryPlay();
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
  // On Capacitor (Android), the native AudioForegroundService handles background
  // playback. The handleUnintendedPause listener would fight Chromium's AudioFocus
  // by re-calling audio.play() after every native pause, creating an infinite loop.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const isCapacitor = typeof (window as unknown as Record<string, unknown>).Capacitor !== 'undefined';
    let resumeTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const handleUnintendedPause = () => {
      if (status === 'playing') {
        audio.play().catch(() => {});
        resumeTimeoutId = setTimeout(() => {
          if (status === 'playing' && audio.paused) {
            audio.play().catch(() => {});
          }
        }, 50);
      }
    };

    const handleKeepPlaying = () => {
      if (status === 'playing' && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    if (!isCapacitor) {
      audio.addEventListener('pause', handleUnintendedPause);
    }
    document.addEventListener('visibilitychange', handleKeepPlaying);
    window.addEventListener('blur', handleKeepPlaying);
    window.addEventListener('focus', handleKeepPlaying);

    return () => {
      if (resumeTimeoutId !== undefined) {
        clearTimeout(resumeTimeoutId);
      }
      if (!isCapacitor) {
        audio.removeEventListener('pause', handleUnintendedPause);
      }
      document.removeEventListener('visibilitychange', handleKeepPlaying);
      window.removeEventListener('blur', handleKeepPlaying);
      window.removeEventListener('focus', handleKeepPlaying);
    };
  }, [audioRef, status]);
};
