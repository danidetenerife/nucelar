import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCarModeStore } from '../../stores/carModeStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { createMockTrack } from '../../test/utils/mockTrack';
import { CarModeOverlay } from './CarModeOverlay';

const user = userEvent.setup();

describe('CarModeOverlay', () => {
  beforeEach(() => {
    useCarModeStore.setState({
      isCarMode: true,
      isBluetoothConnected: true,
      bluetoothDeviceName: 'Car Bluetooth Audio',
    });
    useSoundStore.setState({
      status: 'playing',
      seek: 45,
      duration: 180,
    });
    const mockTrack = createMockTrack('La Incondicional');
    mockTrack.artists = [{ name: 'Luis Miguel' }];
    useQueueStore.setState({
      items: [
        {
          id: 'item-1',
          track: mockTrack,
          status: 'idle',
          addedAtIso: '',
        },
      ],
      currentIndex: 0,
    });
  });

  it('renders correctly when in car mode', () => {
    render(<CarModeOverlay />);

    expect(screen.getByTestId('car-mode-overlay')).toBeInTheDocument();
    expect(screen.getByText('Modo Coche')).toBeInTheDocument();
    expect(screen.getByText('Car Bluetooth Audio')).toBeInTheDocument();
    expect(screen.getByText('La Incondicional')).toBeInTheDocument();
    expect(screen.getByText('Luis Miguel')).toBeInTheDocument();
  });

  it('does not render when car mode is false', () => {
    useCarModeStore.setState({ isCarMode: false });
    render(<CarModeOverlay />);

    expect(screen.queryByTestId('car-mode-overlay')).not.toBeInTheDocument();
  });

  it('exits car mode when clicking Salir button', async () => {
    render(<CarModeOverlay />);

    const exitBtn = screen.getByRole('button', { name: /Salir/i });
    await user.click(exitBtn);

    expect(useCarModeStore.getState().isCarMode).toBe(false);
  });

  it('renders previous and next controls', () => {
    render(<CarModeOverlay />);

    expect(screen.getByTitle('Anterior')).toBeInTheDocument();
    expect(screen.getByTitle('Siguiente')).toBeInTheDocument();
    expect(screen.getByTitle('Pausa')).toBeInTheDocument();
  });
});
