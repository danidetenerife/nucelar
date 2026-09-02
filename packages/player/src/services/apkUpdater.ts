import { registerPlugin } from '@capacitor/core';

export type DownloadProgressData = {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
};

export type AppVersionData = {
  version: string;
  versionCode: number;
};

export type ApkUpdaterPluginInterface = {
  getAppVersion(): Promise<AppVersionData>;
  downloadAndInstall(options: { url: string }): Promise<{ success: boolean }>;
  addListener(
    event: 'downloadProgress',
    handler: (data: DownloadProgressData) => void,
  ): Promise<{ remove: () => void }>;
};

export const ApkUpdaterPlugin = registerPlugin<ApkUpdaterPluginInterface>(
  'ApkUpdater',
  {
    web: {
      getAppVersion: () =>
        Promise.resolve({ version: '1.47.1', versionCode: 10471 }),
      downloadAndInstall: () => Promise.resolve({ success: true }),
      addListener: () => Promise.resolve({ remove: () => {} }),
    },
  },
);
