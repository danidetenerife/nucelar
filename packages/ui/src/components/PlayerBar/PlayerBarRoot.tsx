import { FC, ReactNode } from 'react';

import { BottomBar } from '..';
import { cn } from '../../utils';

export type PlayerBarRootProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
};
export const PlayerBarRoot: FC<PlayerBarRootProps> = ({
  left,
  center,
  right,
  className = '',
}) => (
  <BottomBar className={cn('px-2 sm:px-4 py-1.5 h-14 sm:h-16', className)}>
    <div className="flex w-full items-center justify-between sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 sm:gap-4">
      {left && <div className="min-w-0 flex-1 sm:flex-initial">{left}</div>}
      {center && <div className="justify-self-center shrink-0">{center}</div>}
      {right && <div className="hidden sm:block justify-self-end">{right}</div>}
    </div>
  </BottomBar>
);
