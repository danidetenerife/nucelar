import { FC, useEffect, useRef } from 'react';

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

  // Resume playback when app comes back to foreground from background/screen-off
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'playing') {
        setTimeout(() => {
          try {
            playerRef.current?.playVideo();
          } catch {}
        }, 200);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
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
                // Auto resume on background/screen-off unintended pause
                setTimeout(() => {
                  if (isMounted && statusRef.current === 'playing') {
                    try {
                      playerRef.current?.playVideo();
                    } catch {}
                  }
                }, 100);
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

  return (
    <div
      id="nuclear-youtube-player-container"
      style={
        showVideo
          ? {
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
              width: 0,
              height: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
              opacity: 0,
              top: 0,
              left: 0,
              zIndex: -1,
            }
      }
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {showVideo && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            right: '8px',
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'auto',
          }}
        >
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              backdropFilter: 'blur(4px)',
            }}
          >
            🎬 Videoclip
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById('nuclear-youtube-player-container');
                if (document.fullscreenElement) {
                  document.exitFullscreen?.();
                } else if (el) {
                  el.requestFullscreen?.();
                }
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
              title="Pantalla Completa (TV / Monitor)"
            >
              ⛶ Pantalla Completa
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseVideo?.();
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(220, 38, 38, 0.85)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
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
