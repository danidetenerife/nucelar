import { ComponentProps, FC } from 'react';

import { cn } from '../utils';

type PlayerShellProps = ComponentProps<'div'>;

export const PlayerShell: FC<PlayerShellProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex h-[100dvh] w-full flex-col overflow-hidden select-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
