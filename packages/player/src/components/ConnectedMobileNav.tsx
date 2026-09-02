import { Link, useRouterState } from '@tanstack/react-router';
import {
  GaugeIcon,
  ListMusicIcon,
  MusicIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react';
import { FC } from 'react';

import { cn } from '@nuclearplayer/ui';

import { useSettingsModalStore } from '../stores/settingsModalStore';

export const ConnectedMobileNav: FC = () => {
  const openSettings = useSettingsModalStore((state) => state.open);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const navItems = [
    {
      to: '/dashboard',
      icon: <GaugeIcon className="size-6" />,
      label: 'Panel',
      isActive: currentPath === '/dashboard' || currentPath === '/',
    },
    {
      to: '/favorites/tracks',
      icon: <MusicIcon className="size-6" />,
      label: 'Canciones',
      isActive: currentPath === '/favorites/tracks',
    },
    {
      to: '/favorites/artists',
      icon: <UserIcon className="size-6" />,
      label: 'Artistas',
      isActive: currentPath === '/favorites/artists',
    },
    {
      to: '/playlists',
      icon: <ListMusicIcon className="size-6" />,
      label: 'Playlists',
      isActive: currentPath.startsWith('/playlists'),
    },
  ];

  return (
    <nav className="bg-background-secondary border-border flex md:hidden items-center justify-around border-t-(length:--border-width) px-1 pt-2 pb-16 min-h-[96px] shrink-0 select-none z-50">
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all font-medium',
            item.isActive
              ? 'text-primary font-bold scale-105'
              : 'text-foreground-secondary hover:text-foreground active:scale-95',
          )}
        >
          {item.icon}
          <span className="whitespace-nowrap text-center leading-tight text-[11px] sm:text-xs">
            {item.label}
          </span>
        </Link>
      ))}

      <button
        onClick={() => openSettings()}
        className="flex flex-1 flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all font-medium text-foreground-secondary hover:text-foreground active:scale-95 cursor-pointer"
      >
        <SettingsIcon className="size-6" />
        <span className="whitespace-nowrap text-center leading-tight text-[11px] sm:text-xs">
          Ajustes
        </span>
      </button>
    </nav>
  );
};
