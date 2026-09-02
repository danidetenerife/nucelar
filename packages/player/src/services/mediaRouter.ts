import { registerPlugin } from '@capacitor/core';

type MediaRoute = {
  id: string;
  name: string;
  description: string;
  isSelected: boolean;
};

type GetRoutesResult = {
  routes: MediaRoute[];
};

type RouteChangedEvent = {
  isConnected: boolean;
  routeName?: string;
};

type MediaRouterPluginInterface = {
  openRoutePicker(): Promise<void>;
  getRoutes(): Promise<GetRoutesResult>;
  selectRoute(options: { index: number }): Promise<void>;
  addListener(
    event: 'routeChanged',
    handler: (data: RouteChangedEvent) => void,
  ): Promise<{ remove: () => void }>;
  addListener(
    event: 'routesChanged',
    handler: (data: { changed: boolean }) => void,
  ): Promise<{ remove: () => void }>;
};

const MediaRouterPlugin = registerPlugin<MediaRouterPluginInterface>(
  'MediaRouterPlugin',
  {
    web: {
      openRoutePicker: () => Promise.resolve(),
      getRoutes: () => Promise.resolve({ routes: [] }),
      selectRoute: () => Promise.resolve(),
      addListener: (_event: string, _handler: unknown) =>
        Promise.resolve({ remove: () => {} }),
    },
  },
);

export type { MediaRoute, RouteChangedEvent };
export { MediaRouterPlugin };
