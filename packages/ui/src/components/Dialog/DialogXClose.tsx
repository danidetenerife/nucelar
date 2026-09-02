import { XIcon } from 'lucide-react';
import { FC } from 'react';

import { cn } from '../../utils';
import { Button } from '../Button';
import { useDialogContext } from './context';

type DialogXCloseProps = {
  className?: string;
};

export const DialogXClose: FC<DialogXCloseProps> = ({ className }) => {
  const { onClose } = useDialogContext();

  return (
    <Button
      variant="secondary"
      size="icon-sm"
      onClick={onClose}
      className={cn('absolute top-2.5 right-2.5 z-30 shadow-sm border border-border/40', className)}
      aria-label="Close"
      data-testid="dialog-x-close"
    >
      <XIcon size={16} />
    </Button>
  );
};
