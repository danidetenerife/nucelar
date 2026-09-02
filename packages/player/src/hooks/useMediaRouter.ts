import { useCallback, useEffect, useState } from 'react';

import { MediaRouterPlugin } from '../services/mediaRouter';

type CastState = {
  isConnected: boolean;
  connectedRouteName: string;
};

export const useMediaRouter = () => {
  const [castState, setCastState] = useState<CastState>({
    isConnected: false,
    connectedRouteName: '',
  });

  useEffect(() => {
    let listenerHandle: { remove: () => void } | null = null;

    const attach = async () => {
      try {
        listenerHandle = await MediaRouterPlugin.addListener(
          'routeChanged',
          (data) => {
            setCastState({
              isConnected: data.isConnected,
              connectedRouteName: data.routeName ?? '',
            });
          },
        );
      } catch {
        // Not on Android — ignore
      }
    };

    void attach();

    return () => {
      listenerHandle?.remove();
    };
  }, []);

  const openCastPicker = useCallback(async () => {
    try {
      await MediaRouterPlugin.openRoutePicker();
    } catch {
      // Not available on this platform
    }
  }, []);

  return { castState, openCastPicker };
};
