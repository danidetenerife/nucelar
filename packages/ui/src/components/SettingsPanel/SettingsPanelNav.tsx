import { FC, ReactNode } from 'react';

import { SettingsTab } from './SettingsPanel';
import { SettingsPanelNavItem } from './SettingsPanelNavItem';

type SettingsPanelNavProps = {
  tabs: SettingsTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  footer?: ReactNode;
};

export const SettingsPanelNav: FC<SettingsPanelNavProps> = ({
  tabs,
  activeTab,
  onTabChange,
  footer,
}) => (
  <nav className="border-border flex w-full sm:w-56 shrink-0 flex-row sm:flex-col overflow-x-auto sm:overflow-x-visible border-b-(length:--border-width) sm:border-b-0 sm:border-r-(length:--border-width) p-2 sm:p-4 pr-16 sm:pr-4 gap-1.5 scrollbar-none">
    <div className="flex flex-row sm:flex-col gap-1.5 w-full overflow-x-auto sm:overflow-x-visible items-center sm:items-stretch">
      {tabs.map((tab) => (
        <SettingsPanelNavItem
          key={tab.id}
          id={tab.id}
          label={tab.label}
          icon={tab.icon}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
        />
      ))}
    </div>
    {footer && <div className="hidden sm:block mt-auto">{footer}</div>}
  </nav>
);
