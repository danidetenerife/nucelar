import { registerPlugin } from '@capacitor/core';

type BluetoothStateData = {
  isConnected: boolean;
  deviceName?: string;
};

type PlaybackStatusData = {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
};

type NativeMediaSessionPluginInterface = {
  updateMetadata(options: {
    title: string;
    artist: string;
    album: string;
    artworkUrl: string;
    durationMs?: number;
  }): Promise<void>;
  updatePlaybackState(options: {
    isPlaying: boolean;
    positionMs: number;
  }): Promise<void>;
  playStream(options: {
    url: string;
    positionMs?: number;
  }): Promise<void>;
  pauseStream(): Promise<void>;
  resumeStream(): Promise<void>;
  seekStream(options: {
    positionMs: number;
  }): Promise<void>;
  getPlaybackStatus(): Promise<PlaybackStatusData>;
  isBluetoothConnected(): Promise<BluetoothStateData>;
  addListener(
    event: 'mediaAction',
    handler: (data: { action: string; seekPositionMs?: number }) => void,
  ): Promise<{ remove: () => void }>;
  addListener(
    event: 'bluetoothStateChanged',
    handler: (data: BluetoothStateData) => void,
  ): Promise<{ remove: () => void }>;
};

const NativeMediaSessionPlugin =
  registerPlugin<NativeMediaSessionPluginInterface>(
    'NativeMediaSessionPlugin',
    {
      web: {
        updateMetadata: () => Promise.resolve(),
        updatePlaybackState: () => Promise.resolve(),
        playStream: () => Promise.resolve(),
        pauseStream: () => Promise.resolve(),
        resumeStream: () => Promise.resolve(),
        seekStream: () => Promise.resolve(),
        getPlaybackStatus: () =>
          Promise.resolve({ isPlaying: false, positionMs: 0, durationMs: 0 }),
        isBluetoothConnected: () => Promise.resolve({ isConnected: false }),
        addListener: () => Promise.resolve({ remove: () => {} }),
      },
    },
  );

export { NativeMediaSessionPlugin, type BluetoothStateData, type PlaybackStatusData };
