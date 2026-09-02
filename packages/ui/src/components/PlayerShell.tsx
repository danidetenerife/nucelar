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
        'flex flex-col h-[100dvh] w-screen overflow-hidden select-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
