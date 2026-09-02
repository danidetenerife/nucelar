import {
  BlocksIcon,
  LaptopIcon,
  PaletteIcon,
  Settings2Icon,
} from 'lucide-react';
import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { SettingsPanel } from '@nuclearplayer/ui';

import {
  useSettingsModalStore,
  type SettingsTab,
} from '../stores/settingsModalStore';
import { Plugins } from '../views/Plugins/Plugins';
import { Settings } from '../views/Settings/Settings';
import { SyncSettingsView } from '../views/Sync/SyncSettingsView';
import { Themes } from '../views/Themes/Themes';
import { SocialLinks } from './SocialLinks';
import { VersionString } from './VersionString';

const SETTINGS_TABS = [
  {
    id: 'general' as SettingsTab,
    icon: <Settings2Icon />,
    label: 'Ajustes',
    content: () => <Settings />,
  },
  {
    id: 'sync' as SettingsTab,
    icon: <LaptopIcon />,
    label: 'Vincular con PC',
    content: () => <SyncSettingsView />,
  },
  {
    id: 'themes' as SettingsTab,
    icon: <PaletteIcon />,
    label: 'Temas',
    content: () => <Themes />,
  },
  {
    id: 'plugins' as SettingsTab,
    icon: <BlocksIcon />,
    label: 'Plugins',
    content: () => <Plugins />,
  },
];

export const ConnectedSettingsModal: FC = () => {
  const { t } = useTranslation('preferences');
  const { isOpen, close, activeTab, setActiveTab } = useSettingsModalStore();

  const tabs = SETTINGS_TABS.map((tab) => ({
    ...tab,
    label: tab.id === 'sync' ? 'Vincular con PC' : t(`${tab.id}.title`, tab.label),
  }));

  return (
    <SettingsPanel
      isOpen={isOpen}
      onClose={close}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as SettingsTab)}
      navFooter={
        <div className="flex flex-col items-center gap-2">
          <SocialLinks />
          <VersionString />
        </div>
      }
    />
  );
};
