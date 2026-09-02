import { createRootRoute } from '@tanstack/react-router';
import {
  CableIcon,
  DiscIcon,
  GaugeIcon,
  HistoryIcon,
  ListMusicIcon,
  MusicIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react';

import { useTranslation } from '@nuclearplayer/i18n';
import {
  PlayerShell,
  PlayerWorkspace,
  RouteTransition,
  SidebarNavigation,
  SidebarNavigationItem,
  Toaster,
} from '@nuclearplayer/ui';

import { CarModeOverlay } from '../components/CarMode/CarModeOverlay';
import { ConnectedMobileNav } from '../components/ConnectedMobileNav';
import { ConnectedPlayerBar } from '../components/ConnectedPlayerBar';
import {
  ConnectedQueuePanel,
  QueueHeaderActions,
} from '../components/ConnectedQueuePanel';
import { ConnectedSettingsModal } from '../components/ConnectedSettingsModal';
import { ConnectedTitleBar } from '../components/ConnectedTitleBar';
import { ConnectedTopBar } from '../components/ConnectedTopBar';
import { FlatpakWarningBanner } from '../components/FlatpakWarningBanner';
import { SoundProvider } from '../components/SoundProvider';
import { StreamResolver } from '../components/StreamResolver';
import { GlobalShortcuts } from '../shortcuts';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';
import { useStartupStore } from '../stores/startupStore';

import { isTauriEnvironment } from '../services/universalStore';

const RootComponent = () => {
  const { t } = useTranslation('navigation');
  const { t: tPrefs } = useTranslation('preferences');
  const isTauri = isTauriEnvironment();
  const {
    leftSidebar,
    rightSidebar,
    toggleLeftSidebar,
    toggleRightSidebar,
    setLeftSidebarWidth,
    setRightSidebarWidth,
  } = useLayoutStore();
  const openSettings = useSettingsModalStore((state) => state.open);
  const isStartingUp = useStartupStore((state) => state.isStartingUp);
  return (
    <PlayerShell onContextMenu={(e) => e.preventDefault()}>
      <GlobalShortcuts />
      <div className="pt-7 sm:pt-0 shrink-0">
        {isTauri && <ConnectedTitleBar />}
        {isTauri && <FlatpakWarningBanner />}
        <ConnectedTopBar />
      </div>
      {!isStartingUp && <StreamResolver />}
      <SoundProvider>
        <PlayerWorkspace>
          <PlayerWorkspace.LeftSidebar
            className="hidden md:flex"
            width={leftSidebar.width}
            isCollapsed={leftSidebar.isCollapsed}
            onWidthChange={setLeftSidebarWidth}
            onToggle={toggleLeftSidebar}
          >
            <SidebarNavigation isCompact={leftSidebar.isCollapsed}>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                <SidebarNavigationItem
                  to="/dashboard"
                  icon={<GaugeIcon />}
                  label={t('dashboard')}
                />
                <SidebarNavigationItem
                  to="/favorites/albums"
                  icon={<DiscIcon />}
                  label={t('favoriteAlbums')}
                />
                <SidebarNavigationItem
                  to="/favorites/tracks"
                  icon={<MusicIcon />}
                  label={t('favoriteTracks')}
                />
                <SidebarNavigationItem
                  to="/favorites/artists"
                  icon={<UserIcon />}
                  label={t('favoriteArtists')}
                />
                <SidebarNavigationItem
                  to="/playlists"
                  icon={<ListMusicIcon />}
                  label={t('playlists')}
                />
                <SidebarNavigationItem
                  to="/history"
                  icon={<HistoryIcon />}
                  label={t('history')}
                />
                <SidebarNavigationItem
                  to="/sources"
                  icon={<CableIcon />}
                  label={t('sources')}
                />
              </div>
              <SidebarNavigationItem
                icon={<SettingsIcon />}
                label={tPrefs('title')}
                onClick={() => openSettings()}
              />
            </SidebarNavigation>
          </PlayerWorkspace.LeftSidebar>

          <PlayerWorkspace.Main className="w-full min-w-0">
            <RouteTransition />
          </PlayerWorkspace.Main>

          <PlayerWorkspace.RightSidebar
            className="hidden md:flex"
            width={rightSidebar.width}
            isCollapsed={rightSidebar.isCollapsed}
            onWidthChange={setRightSidebarWidth}
            onToggle={toggleRightSidebar}
            headerActions={<QueueHeaderActions />}
          >
            <ConnectedQueuePanel isCollapsed={rightSidebar.isCollapsed} />
          </PlayerWorkspace.RightSidebar>
        </PlayerWorkspace>
      </SoundProvider>

      <div className="flex flex-col shrink-0">
        <ConnectedPlayerBar />
        <ConnectedMobileNav />
      </div>
      <Toaster
        position={isTauri ? 'bottom-right' : 'top-center'}
        mobileOffset={{ top: '64px', bottom: '120px' }}
      />
      <ConnectedSettingsModal />
      <CarModeOverlay />
    </PlayerShell>
  );
};

export const Route = createRootRoute({
  component: RootComponent,
});
