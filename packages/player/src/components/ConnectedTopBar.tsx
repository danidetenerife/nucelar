import { useCanGoBack, useRouter } from '@tanstack/react-router';
import { FC } from 'react';

import {
  TopBar,
  TopBarLogo,
  TopBarNavigation,
} from '@nuclearplayer/ui';

import { useCanGoForward } from '../hooks/useCanGoForward';
import { SearchBox } from './SearchBox';
import { UpdateBadge } from './UpdateBadge';

export const ConnectedTopBar: FC = () => {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const canGoForward = useCanGoForward();

  return (
    <TopBar draggable={false}>
      <div className="flex flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <TopBarLogo />
          <span className="font-heading text-sm font-extrabold tracking-wider bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent hidden sm:inline select-none">
            AURORA
          </span>
        </div>
        <TopBarNavigation
          onBack={() => router.history.back()}
          onForward={() => router.history.forward()}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
        />
        <UpdateBadge />
      </div>
      <SearchBox />
      <div className="flex flex-row items-center justify-end gap-2" />
    </TopBar>
  );
};
