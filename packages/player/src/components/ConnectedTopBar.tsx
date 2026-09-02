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
        <div className="flex items-center">
          <TopBarLogo />
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
