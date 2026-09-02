import { getCurrentWindow } from '@tauri-apps/api/window';
import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { TitleBar } from '@nuclearplayer/ui';

import { useCoreSetting } from '../hooks/useCoreSetting';
import { isTauriEnvironment } from '../services/universalStore';

export const ConnectedTitleBar: FC = () => {
  const [isEnabled] = useCoreSetting<boolean>('appearance.customTitleBar');
  const { t } = useTranslation('titleBar');
  const [titleBarStyle] = useCoreSetting<string>('appearance.titleBarStyle');

  if (!isTauriEnvironment() || !isEnabled) {
    return null;
  }

  const appWindow = getCurrentWindow();

  const styleOverride =
    titleBarStyle === 'auto' || !titleBarStyle
      ? undefined
      : (titleBarStyle as 'macos' | 'windows');

  return (
    <TitleBar
      title={t('title')}
      styleOverride={styleOverride}
      onMinimize={() => appWindow.minimize()}
      onMaximize={() => appWindow.toggleMaximize()}
      onClose={() => appWindow.close()}
      onStartDrag={() => appWindow.startDragging()}
      labels={{
        minimize: t('minimize'),
        maximize: t('maximize'),
        close: t('close'),
      }}
    />
  );
};
