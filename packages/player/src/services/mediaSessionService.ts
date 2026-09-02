import { pickArtwork } from '@nuclearplayer/model';

import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { NativeMediaSessionPlugin } from './nativeMediaSession';
import { playbackManager } from './playback';
import { isCapacitorEnvironment } from './universalStore';

const secondsToMs = (seconds: number): number => Math.round(seconds * 1000);

export const initMediaSessionService = () => {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }

  try {
    navigator.mediaSession.setActionHandler('play', () => {
      playbackManager.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      playbackManager.pause();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      useQueueStore.getState().goToPrevious();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      useQueueStore.getState().goToNext();
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        useSoundStore.getState().seekTo(details.seekTime);
      }
    });
  } catch {
    // Some browsers or WebViews might ignore specific actions
  }

  useQueueStore.subscribe((state) => {
    const currentItem = state.getCurrentItem();
    if (!currentItem) {
      return;
    }

    const track = currentItem.track;
    const artwork = pickArtwork(track.artwork, 'thumbnail', 512);
    const artist = track.artists?.map((artistCredit) => artistCredit.name).join(', ') || '';
    const albumTitle = track.album?.title || '';
    const artworkUrl = artwork?.url || '';

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist,
        album: albumTitle,
        artwork: artworkUrl
          ? [
              {
                src: artworkUrl,
                sizes: '512x512',
                type: 'image/png',
              },
            ]
          : [],
      });
    } catch {
      // ignore
    }

    const durationMs = track.durationMs;

    if (isCapacitorEnvironment()) {
      NativeMediaSessionPlugin.updateMetadata({
        title: track.title,
        artist,
        album: albumTitle,
        artworkUrl,
        durationMs,
      }).catch(() => {});
    }
  });

  let lastStatus = '';
  let lastReportedSeek = 0;
  let lastReportedTime = 0;
  let lastStreamUrl = '';
  let isInternalSeekUpdate = false;

  useSoundStore.subscribe((state) => {
    const isPlaying = state.status === 'playing';
    const statusChanged = state.status !== lastStatus;
    const now = Date.now();
    const seekDelta = Math.abs(state.seek - lastReportedSeek);
    const timeDelta = now - lastReportedTime;

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      // ignore
    }

    if (isCapacitorEnvironment()) {
      const currentUrl = state.src?.url || '';
      if (currentUrl && currentUrl !== lastStreamUrl && isPlaying) {
        lastStreamUrl = currentUrl;
        NativeMediaSessionPlugin.playStream({
          url: currentUrl,
          positionMs: secondsToMs(state.seek),
        }).catch(() => {});
      } else if (state.status === 'playing' && lastStatus === 'paused') {
        NativeMediaSessionPlugin.resumeStream().catch(() => {});
      } else if (state.status === 'paused' && lastStatus === 'playing') {
        NativeMediaSessionPlugin.pauseStream().catch(() => {});
      }

      if (!isInternalSeekUpdate && seekDelta > 2) {
        NativeMediaSessionPlugin.seekStream({
          positionMs: secondsToMs(state.seek),
        }).catch(() => {});
      }

      if (statusChanged || seekDelta > 3 || timeDelta > 15000) {
        lastStatus = state.status;
        lastReportedSeek = state.seek;
        lastReportedTime = now;

        NativeMediaSessionPlugin.updatePlaybackState({
          isPlaying,
          positionMs: secondsToMs(state.seek),
        }).catch(() => {});
      }
    }
  });

  if (isCapacitorEnvironment()) {
    setInterval(() => {
      if (useSoundStore.getState().status === 'playing') {
        NativeMediaSessionPlugin.getPlaybackStatus()
          .then((status) => {
            if (status && status.durationMs > 0) {
              isInternalSeekUpdate = true;
              useSoundStore
                .getState()
                .updatePlayback(status.positionMs / 1000, status.durationMs / 1000);
              isInternalSeekUpdate = false;
            }
          })
          .catch(() => {});
      }
    }, 1000);

    NativeMediaSessionPlugin.addListener('mediaAction', (data) => {
      switch (data.action) {
        case 'play':
          playbackManager.play();
          break;
        case 'pause':
          playbackManager.pause();
          break;
        case 'nexttrack':
          useQueueStore.getState().goToNext();
          break;
        case 'previoustrack':
          useQueueStore.getState().goToPrevious();
          break;
        case 'seekto':
          if (data.seekPositionMs != null && data.seekPositionMs >= 0) {
            useSoundStore.getState().seekTo(data.seekPositionMs / 1000);
          }
          break;
        case 'stop':
          playbackManager.pause();
          break;
      }
    }).catch(() => {});
  }
};
