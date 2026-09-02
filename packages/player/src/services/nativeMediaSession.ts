import { registerPlugin } from '@capacitor/core';

type BluetoothStateData = {
  isConnected: boolean;
  deviceName?: string;
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
        isBluetoothConnected: () => Promise.resolve({ isConnected: false }),
        addListener: () => Promise.resolve({ remove: () => {} }),
      },
    },
  );

export { NativeMediaSessionPlugin, type BluetoothStateData };
