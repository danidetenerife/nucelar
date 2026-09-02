import { FC, useCallback, useEffect, useRef, useState } from 'react';

import { SoundProps } from './types';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YTPlayerInstance = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState?: () => number;
  destroy: () => void;
};

const extractYouTubeVideoId = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
  );
  return match ? match[1] : null;
};

export const YouTubePlayer: FC<SoundProps> = ({
  src,
  status,
  seek,
  volume,
  showVideo = false,
  onCloseVideo,
  onTimeUpdate,
  onEnd,
  onCanPlay,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastSeekRef = useRef<number | undefined>(undefined);
  const hasEndedRef = useRef<boolean>(false);
  const videoId = extractYouTubeVideoId(src.url);

  // Mutable refs to prevent stale closure bugs
  const statusRef = useRef(status);
  statusRef.current = status;

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const onCanPlayRef = useRef(onCanPlay);
  onCanPlayRef.current = onCanPlay;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Keep playback running through screen off, backgrounding, and foregrounding
  useEffect(() => {
    const handleKeepPlaying = () => {
      if (statusRef.current === 'playing') {
        try {
          const player = playerRef.current;
          if (player) {
            const playerState = player.getPlayerState?.();
            if (playerState !== 1) {
              player.playVideo();
            }
          }
        } catch {}
      }
    };

    document.addEventListener('visibilitychange', handleKeepPlaying);
    window.addEventListener('blur', handleKeepPlaying);
    window.addEventListener('focus', handleKeepPlaying);

    return () => {
      document.removeEventListener('visibilitychange', handleKeepPlaying);
      window.removeEventListener('blur', handleKeepPlaying);
      window.removeEventListener('focus', handleKeepPlaying);
    };
  }, []);

  useEffect(() => {
    if (!videoId) {
      return;
    }

    let isMounted = true;
    hasEndedRef.current = false;

    const initPlayer = () => {
      if (!window.YT?.Player || !containerRef.current || !isMounted) {
        return;
      }

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }

      try {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          events: {
            onReady: (event) => {
              if (!isMounted) {
                return;
              }
              if (volume !== undefined) {
                try {
                  event.target.setVolume(volume);
                } catch {}
              }
              if (seek && seek > 0) {
                try {
                  event.target.seekTo(seek, true);
                } catch {}
              }
              onCanPlayRef.current?.();
              if (statusRef.current === 'playing') {
                try {
                  event.target.playVideo();
                } catch {}
              } else {
                try {
                  event.target.pauseVideo();
                } catch {}
              }
            },
            onStateChange: (event) => {
              if (!isMounted) {
                return;
              }
              if (event.data === window.YT?.PlayerState.ENDED) {
                if (!hasEndedRef.current) {
                  hasEndedRef.current = true;
                  onEndRef.current?.();
                }
              } else if (
                event.data === window.YT?.PlayerState.PLAYING &&
                statusRef.current !== 'playing'
              ) {
                try {
                  event.target.pauseVideo();
                } catch {}
              } else if (
                event.data === window.YT?.PlayerState.PAUSED &&
                statusRef.current === 'playing'
              ) {
                // Auto resume immediately on background/screen-off unintended pause
                try {
                  event.target.playVideo();
                } catch {}
                setTimeout(() => {
                  if (isMounted && statusRef.current === 'playing') {
                    try {
                      playerRef.current?.playVideo();
                    } catch {}
                  }
                }, 50);
              }
            },
            onError: () => {
              if (isMounted && !hasEndedRef.current) {
                onErrorRef.current?.(new Error('YouTube playback failed'));
              }
            },
          },
        });
      } catch (err) {
        if (isMounted && !hasEndedRef.current) {
          onErrorRef.current?.(err instanceof Error ? err : new Error('YouTube init failed'));
        }
      }
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        initPlayer();
      };
    }

    return () => {
      isMounted = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    if (status === 'playing') {
      try {
        player.playVideo();
      } catch {}
    } else if (status === 'paused') {
      try {
        player.pauseVideo();
      } catch {}
    } else if (status === 'stopped') {
      try {
        player.stopVideo();
      } catch {}
    }
  }, [status]);

  useEffect(() => {
    const player = playerRef.current;
    if (player && volume !== undefined) {
      try {
        player.setVolume(volume);
      } catch {}
    }
  }, [volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || seek === undefined) {
      return;
    }

    try {
      const currentTime = player.getCurrentTime() || 0;
      const seekDelta = Math.abs(seek - currentTime);

      if (lastSeekRef.current !== seek && seekDelta > 2) {
        player.seekTo(seek, true);
      }
      lastSeekRef.current = seek;
    } catch {}
  }, [seek]);

  useEffect(() => {
    if (status === 'playing') {
      intervalRef.current = window.setInterval(() => {
        const player = playerRef.current;
        if (player) {
          try {
            const position = player.getCurrentTime() || 0;
            const duration = player.getDuration() || 0;
            onTimeUpdateRef.current?.({ position, duration });

            if (
              duration > 0 &&
              position >= duration - 0.8 &&
              !hasEndedRef.current
            ) {
              hasEndedRef.current = true;
              onEndRef.current?.();
            }
          } catch {
            // ignore
          }
        }
      }, 500);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status]);

  const [isTvFullscreen, setIsTvFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3500);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showVideo) return;

      if (event.key === 'Escape' && isTvFullscreen) {
        setIsTvFullscreen(false);
      } else if (event.key.toLowerCase() === 'f') {
        setIsTvFullscreen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showVideo, isTvFullscreen]);

  return (
    <div
      id="nuclear-youtube-player-container"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      style={
        showVideo
          ? isTvFullscreen
            ? {
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                width: '100dvw',
                height: '100dvh',
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }
            : {
                position: 'fixed',
                bottom: '160px',
                right: '16px',
                zIndex: 60,
                width: 'calc(100vw - 32px)',
                maxWidth: '420px',
                aspectRatio: '16/9',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: '#000',
                overflow: 'hidden',
              }
          : {
              position: 'fixed',
              top: '-9999px',
              left: '-9999px',
              width: '320px',
              height: '180px',
              overflow: 'hidden',
              pointerEvents: 'none',
              opacity: 0.001,
              zIndex: -999,
            }
      }
    >
      <div
        ref={containerRef}
        style={{
          width: isTvFullscreen ? 'min(100dvw, calc(100dvh * 16 / 9))' : '100%',
          height: isTvFullscreen
            ? 'min(100dvh, calc(100dvw * 9 / 16))'
            : '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          aspectRatio: isTvFullscreen ? '16/9' : undefined,
          flexShrink: 0,
        }}
      />
      {showVideo && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'auto',
            opacity: !isTvFullscreen || showControls ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
        >
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🎬 {isTvFullscreen ? 'Modo TV Videoclip' : 'Videoclip'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsTvFullscreen((prev) => !prev);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
              title="Pantalla Completa TV"
            >
              {isTvFullscreen ? '🗗 Minimizar' : '⛶ Modo TV'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isTvFullscreen) {
                  setIsTvFullscreen(false);
                }
                onCloseVideo?.();
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(220, 38, 38, 0.9)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
              title="Cerrar Videoclip"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
