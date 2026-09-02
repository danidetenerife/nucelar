import {
  ArrowUpCircle,
  RotateCw as RotateCwIcon,
  Settings as SettingsIcon,
  Trash as TrashIcon,
  TriangleAlert as TriangleAlertIcon,
} from 'lucide-react';
import { FC, ReactNode } from 'react';

import '../../styles.css';

import { cn } from '../../utils';
import { Badge } from '../Badge';
import { Box } from '../Box';
import { Button } from '../Button';

type PluginItemProps = {
  name: string;
  author: string;
  description: string;
  version?: string;
  updateAvailable?: boolean;
  icon?: ReactNode;
  onViewDetails?: () => void;
  className?: string;
  disabled?: boolean;
  warning?: boolean;
  warningText?: string;
  rightAccessory?: ReactNode;
  loadTimeMs?: number;
  onReload?: () => void;
  onRemove?: () => void;
  reloadDisabled?: boolean;
  removeDisabled?: boolean;
  isLoading?: boolean;
  labels?: {
    by?: string;
    updateAvailable?: string;
  };
};

export const PluginItem: FC<PluginItemProps> = ({
  name,
  author,
  description,
  version,
  updateAvailable = false,
  icon,
  onViewDetails,
  className,
  disabled = false,
  warning = false,
  warningText,
  rightAccessory,
  loadTimeMs,
  onReload,
  onRemove,
  reloadDisabled = false,
  removeDisabled = false,
  isLoading = false,
  labels = {},
}) => (
  <div className="flex w-full flex-col sm:flex-row gap-2">
    <Box
      data-testid="plugin-item"
      variant={warning ? 'warning' : 'tertiary'}
      className={cn(
        {
          'ring-accent-orange cursor-default ring-2 select-none ring-inset':
            warning,
          'opacity-30': disabled && !isLoading,
        },
        'relative flex flex-1 cursor-default flex-col gap-2 p-3 sm:p-4 overflow-hidden transition-opacity duration-250',
        className,
      )}
      aria-busy={isLoading}
    >
      <div className="flex w-full items-start gap-3">
        {icon && (
          <Box
            variant="tertiary"
            className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden p-0"
          >
            {icon}
          </Box>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-foreground inline-flex flex-wrap items-baseline gap-1.5 text-base sm:text-lg leading-tight font-bold select-none">
              <span data-testid="plugin-name">{name}</span>
              <span className="text-foreground-secondary text-xs sm:text-sm font-normal select-none">
                <span className="mr-1 opacity-60">{labels.by ?? 'by'}</span>
                <span data-testid="plugin-author">{author}</span>
              </span>
            </h3>
            {rightAccessory && (
              <div className={cn('shrink-0', { 'pointer-events-none': isLoading })}>
                {rightAccessory}
              </div>
            )}
          </div>
          <p
            data-testid="plugin-description"
            className="text-foreground mt-1.5 text-xs sm:text-sm leading-relaxed select-none"
          >
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/40">
        <span
          data-testid="plugin-version"
          className="text-foreground-secondary flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-normal"
        >
          {loadTimeMs && (
            <Badge color="purple" variant="pill">
              {loadTimeMs}ms
            </Badge>
          )}
          {version && (
            <Badge color="inverted" variant="pill">
              v{version}
            </Badge>
          )}
          {updateAvailable && (
            <Badge
              data-testid="plugin-update-available"
              variant="pill"
              color="green"
              className="flex flex-row gap-1"
            >
              <ArrowUpCircle size={12} />
              {labels.updateAvailable ?? 'Update available'}
            </Badge>
          )}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {onViewDetails && (
            <Button
              data-testid="plugin-action-view-details"
              size="icon-sm"
              onClick={onViewDetails}
              disabled={disabled || isLoading}
            >
              <SettingsIcon size={16} />
            </Button>
          )}
          {onReload && !isLoading && (
            <Button
              data-testid="plugin-action-reload"
              size="icon-sm"
              onClick={onReload}
              disabled={reloadDisabled || disabled}
            >
              <RotateCwIcon size={16} />
            </Button>
          )}
          {onRemove && !isLoading && (
            <Button
              data-testid="plugin-action-remove"
              size="icon-sm"
              intent="danger"
              onClick={onRemove}
              disabled={removeDisabled}
            >
              <TrashIcon size={16} />
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="bg-stripes-diagonal absolute right-0 bottom-0 left-0 h-1" />
      )}

      {(warning || warningText) && !isLoading && (
        <Box
          shadow="none"
          variant="tertiary"
          className="flex-row items-center justify-start gap-1 px-2 py-1 text-xs"
        >
          <TriangleAlertIcon size={16} color="var(--accent-orange)" />
          {warningText}
        </Box>
      )}
    </Box>
  </div>
);
