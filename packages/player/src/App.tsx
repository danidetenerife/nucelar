import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { FC } from 'react';
import { I18nextProvider } from 'react-i18next';

import { i18n } from '@nuclearplayer/i18n';
import { Platform, PlatformProvider } from '@nuclearplayer/ui';

import { routeTree } from './routeTree.gen';
import { isTauriEnvironment } from './services/universalStore';

const history = isTauriEnvironment() ? undefined : createHashHistory();
const router = createRouter({
  routeTree,
  history,
  defaultPreload: 'intent',
});
export const defaultQueryClient = new QueryClient();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

type AppProps = {
  routerProp?: typeof router;
  queryClientProp?: QueryClient;
};

const getAppPlatform = (): Platform => {
  return isTauriEnvironment() ? 'windows' : 'linux';
};

const App: FC<AppProps> = ({ routerProp, queryClientProp }) => {
  return (
    <PlatformProvider platform={getAppPlatform()}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClientProp ?? defaultQueryClient}>
          <RouterProvider router={routerProp ?? router} />
        </QueryClientProvider>
      </I18nextProvider>
    </PlatformProvider>
  );
};

export default App;
