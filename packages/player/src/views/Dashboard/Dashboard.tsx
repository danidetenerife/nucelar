import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { Loader, ViewShell } from '@nuclearplayer/ui';

import { useStartupStore } from '../../stores/startupStore';
import { PersonalizedMixWidget } from './components/PersonalizedMixWidget';

const DashboardContent: FC<{ isStartingUp: boolean }> = ({ isStartingUp }) => {
  if (isStartingUp) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader data-testid="dashboard-loader" size="xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <PersonalizedMixWidget />
    </div>
  );
};

export const Dashboard: FC = () => {
  const { t } = useTranslation('dashboard');
  const isStartingUp = useStartupStore((state) => state.isStartingUp);

  return (
    <ViewShell data-testid="dashboard-view" title={t('title')}>
      <DashboardContent isStartingUp={isStartingUp} />
    </ViewShell>
  );
};
