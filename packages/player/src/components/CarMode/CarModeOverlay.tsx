import {
  Car,
  ChevronDown,
  Heart,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { FC, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { pickArtwork } from '@nuclearplayer/model';
import { RepeatMode } from '@nuclearplayer/plugin-sdk';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { playbackManager } from '../../services/playback';
import { useCarModeStore } from '../../stores/carModeStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';

const formatSeconds = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const CarModeOverlay: FC = () => {
  const isCarMode = useCarModeStore((state) => state.isCarMode);
  const exitCarMode = useCarModeStore((state) => state.exitCarMode);
  const isBluetoothConnected = useCarModeStore(
    (state) => state.isBluetoothConnected,
  );
  const bluetoothDeviceName = useCarModeStore(
    (state) => state.bluetoothDeviceName,
  );

  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const currentTrack = currentItem?.track;

  const { goToNext, goToPrevious } = useQueueStore(
    useShallow((state) => ({
      goToNext: state.goToNext,
      goToPrevious: state.goToPrevious,
    })),
  );

  const status = useSoundStore((state) => state.status);
  const seek = useSoundStore((state) => state.seek);
  const duration = useSoundStore((state) => state.duration);
  const seekTo = useSoundStore((state) => state.seekTo);

  const isPlaying = status === 'playing';

  const [shuffleEnabled, setShuffleEnabled] =
    useCoreSetting<boolean>('playback.shuffle');
  const [repeatMode, setRepeatMode] =
    useCoreSetting<RepeatMode>('playback.repeat');

  const { isTrackFavorite, addTrack, removeTrack } = useFavoritesStore(
    useShallow((state) => ({
      isTrackFavorite: state.isTrackFavorite,
      addTrack: state.addTrack,
      removeTrack: state.removeTrack,
    })),
  );

  const isFav = currentTrack ? isTrackFavorite(currentTrack.source) : false;

  const handleToggleFavorite = () => {
    if (!currentTrack) return;
    if (isFav) {
      void removeTrack(currentTrack.source);
    } else {
      void addTrack(currentTrack);
    }
  };

  const handleToggleRepeat = () => {
    const modes: Array<RepeatMode> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode ?? 'off');
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  const artwork = useMemo(() => {
    if (!currentTrack?.artwork) return undefined;
    return (
      pickArtwork(currentTrack.artwork, 'cover', 600) ??
      pickArtwork(currentTrack.artwork, 'thumbnail', 600)
    );
  }, [currentTrack]);

  const [seekingValue, setSeekingValue] = useState<number | null>(null);

  if (!isCarMode) {
    return null;
  }

  const effectiveTime = seekingValue ?? seek;

  return (
    <div
      data-testid="car-mode-overlay"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-zinc-950 text-white select-none overflow-hidden"
    >
      {/* Dynamic ambient backdrop blur */}
      {artwork?.url && (
        <div
          className="absolute inset-0 opacity-20 blur-3xl scale-125 pointer-events-none transition-all duration-1000 bg-cover bg-center"
          style={{ backgroundImage: `url(${artwork.url})` }}
        />
      )}

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-800/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-zinc-700/60 shadow-lg">
            <Car size={18} className="text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Modo Coche
            </span>
            {isBluetoothConnected && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium pl-1 border-l border-zinc-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {bluetoothDeviceName || 'Bluetooth'}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={exitCarMode}
          className="flex items-center gap-2 bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 text-zinc-200 px-4 py-2 rounded-full border border-zinc-700 shadow-md font-bold text-sm transition-all"
        >
          <ChevronDown size={18} />
          <span>Salir</span>
        </button>
      </div>

      {/* Main Track Display (Center) */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-2 min-h-0">
        {/* Giant Artwork */}
        <div className="relative aspect-square max-h-[36vh] sm:max-h-[44vh] w-auto rounded-2xl overflow-hidden shadow-2xl border-2 border-zinc-700/80 bg-zinc-900 mb-6 flex items-center justify-center">
          {artwork?.url ? (
            <img
              src={artwork.url}
              alt={currentTrack?.title ?? 'Artwork'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-600">
              <Music size={80} />
            </div>
          )}
        </div>

        {/* Track Title & Artist */}
        <div className="w-full max-w-lg text-center px-4 space-y-1.5">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight truncate text-white drop-shadow-md">
            {currentTrack?.title ?? 'Sin reproducción'}
          </h1>
          <p className="text-lg sm:text-2xl font-semibold text-zinc-300 truncate">
            {currentTrack?.artists?.[0]?.name ?? 'Nuclear'}
          </p>
        </div>
      </div>

      {/* Bottom Controls Area */}
      <div className="relative z-10 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800/80 px-6 pt-4 pb-8 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        {/* Scrubber / Progress Bar */}
        <div className="w-full space-y-1">
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={effectiveTime}
              onChange={(e) => setSeekingValue(Number(e.target.value))}
              onMouseUp={() => {
                if (seekingValue !== null) {
                  seekTo(seekingValue);
                  setSeekingValue(null);
                }
              }}
              onTouchEnd={() => {
                if (seekingValue !== null) {
                  seekTo(seekingValue);
                  setSeekingValue(null);
                }
              }}
              className="w-full h-3 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
          <div className="flex justify-between text-sm font-bold text-zinc-400 px-0.5">
            <span>{formatSeconds(effectiveTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>

        {/* Giant Primary Buttons */}
        <div className="flex items-center justify-between gap-3 px-2 sm:px-6">
          {/* Shuffle */}
          <button
            onClick={() => setShuffleEnabled(!shuffleEnabled)}
            className={`p-3 rounded-full transition-all active:scale-90 ${
              shuffleEnabled
                ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/40'
                : 'text-zinc-400 hover:text-white bg-zinc-800/60'
            }`}
            title="Aleatorio"
          >
            <Shuffle size={24} />
          </button>

          {/* Previous Track */}
          <button
            onClick={goToPrevious}
            className="flex items-center justify-center size-16 sm:size-18 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-90 text-white shadow-lg border border-zinc-700/80 transition-transform"
            title="Anterior"
          >
            <SkipBack size={32} />
          </button>

          {/* Play / Pause - HUGE */}
          <button
            onClick={playbackManager.toggle}
            className="flex items-center justify-center size-20 sm:size-24 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 shadow-emerald-500/30 shadow-2xl transition-all font-bold"
            title={isPlaying ? 'Pausa' : 'Reproducir'}
          >
            {isPlaying ? (
              <Pause size={44} className="fill-current" />
            ) : (
              <Play size={44} className="fill-current translate-x-0.5" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={goToNext}
            className="flex items-center justify-center size-16 sm:size-18 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-90 text-white shadow-lg border border-zinc-700/80 transition-transform"
            title="Siguiente"
          >
            <SkipForward size={32} />
          </button>

          {/* Repeat */}
          <button
            onClick={handleToggleRepeat}
            className={`p-3 rounded-full transition-all active:scale-90 ${
              repeatMode !== 'off'
                ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/40'
                : 'text-zinc-400 hover:text-white bg-zinc-800/60'
            }`}
            title="Repetir"
          >
            {repeatMode === 'one' ? <Repeat1 size={24} /> : <Repeat size={24} />}
          </button>

          {/* Favorite */}
          <button
            onClick={handleToggleFavorite}
            className={`p-3 rounded-full transition-all active:scale-90 ${
              isFav
                ? 'text-red-500 bg-red-950/60 border border-red-500/40'
                : 'text-zinc-400 hover:text-white bg-zinc-800/60'
            }`}
            title="Favorito"
          >
            <Heart size={24} className={isFav ? 'fill-current' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
};
