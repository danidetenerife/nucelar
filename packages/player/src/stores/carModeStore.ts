import { create } from 'zustand';

import {
  NativeMediaSessionPlugin,
  type BluetoothStateData,
} from '../services/nativeMediaSession';
import { isCapacitorEnvironment } from '../services/universalStore';

const STORAGE_KEY_AUTO_CAR_MODE = 'nuclear_auto_car_mode_enabled';

type CarModeState = {
  isCarMode: boolean;
  autoCarModeEnabled: boolean;
  isBluetoothConnected: boolean;
  bluetoothDeviceName: string;
  enterCarMode: () => void;
  exitCarMode: () => void;
  toggleCarMode: () => void;
  setAutoCarModeEnabled: (enabled: boolean) => void;
};

const getInitialAutoCarMode = (): boolean => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AUTO_CAR_MODE);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
};

export const useCarModeStore = create<CarModeState>((set) => ({
  isCarMode: false,
  autoCarModeEnabled: getInitialAutoCarMode(),
  isBluetoothConnected: false,
  bluetoothDeviceName: '',

  enterCarMode: () => {
    set({ isCarMode: true });
  },

  exitCarMode: () => {
    set({ isCarMode: false });
  },

  toggleCarMode: () => {
    set((state) => ({ isCarMode: !state.isCarMode }));
  },

  setAutoCarModeEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_CAR_MODE, String(enabled));
    } catch {
      // ignore
    }
    set({ autoCarModeEnabled: enabled });
  },
}));

let isInitialized = false;

export const initCarModeService = async (): Promise<void> => {
  if (isInitialized) return;
  isInitialized = true;

  if (!isCapacitorEnvironment()) return;

  try {
    const initialStatus = await NativeMediaSessionPlugin.isBluetoothConnected();
    if (initialStatus?.isConnected) {
      useCarModeStore.setState({
        isBluetoothConnected: true,
        bluetoothDeviceName: initialStatus.deviceName || 'Bluetooth',
      });
      if (useCarModeStore.getState().autoCarModeEnabled) {
        useCarModeStore.getState().enterCarMode();
      }
    }

    await NativeMediaSessionPlugin.addListener(
      'bluetoothStateChanged',
      (data: BluetoothStateData) => {
        const { isConnected, deviceName } = data;
        useCarModeStore.setState({
          isBluetoothConnected: isConnected,
          bluetoothDeviceName: deviceName || (isConnected ? 'Bluetooth' : ''),
        });

        if (isConnected) {
          if (useCarModeStore.getState().autoCarModeEnabled) {
            useCarModeStore.getState().enterCarMode();
          }
        } else {
          // Disconnected from Bluetooth
          if (useCarModeStore.getState().isCarMode) {
            useCarModeStore.getState().exitCarMode();
          }
        }
      },
    );
  } catch (error) {
    console.warn('Failed to initialize Car Mode Bluetooth listener:', error);
  }
};
