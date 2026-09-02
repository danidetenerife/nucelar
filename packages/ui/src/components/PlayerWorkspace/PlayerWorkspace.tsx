import { FC, ReactNode } from 'react';

import { cn } from '../../utils';
import { PlayerWorkspaceLeftSidebar } from './PlayerWorkspaceLeftSidebar';
import { PlayerWorkspaceRightSidebar } from './PlayerWorkspaceRightSidebar';

type PlayerWorkspaceProps = {
  children: ReactNode;
  className?: string;
};

type MainProps = {
  children?: ReactNode;
  className?: string;
};

const PlayerWorkspaceMain: FC<MainProps> = ({ children, className = '' }) => {
  return (
    <main
      data-testid="player-workspace-main"
      className={cn('bg-background-secondary flex-1 min-h-0 overflow-y-auto w-full', className)}
    >
      {children}
    </main>
  );
};

type PlayerWorkspaceComponent = FC<PlayerWorkspaceProps> & {
  LeftSidebar: typeof PlayerWorkspaceLeftSidebar;
  RightSidebar: typeof PlayerWorkspaceRightSidebar;
  Main: typeof PlayerWorkspaceMain;
};

const PlayerWorkspaceImpl: FC<PlayerWorkspaceProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={cn(
        'bg-background-secondary relative flex flex-1 md:grid h-full min-h-0 md:grid-cols-[auto_1fr_auto] overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
};

export const PlayerWorkspace = PlayerWorkspaceImpl as PlayerWorkspaceComponent;
PlayerWorkspace.LeftSidebar = PlayerWorkspaceLeftSidebar;
PlayerWorkspace.RightSidebar = PlayerWorkspaceRightSidebar;
PlayerWorkspace.Main = PlayerWorkspaceMain;
