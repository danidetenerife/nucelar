import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import semver from 'semver';
import { create } from 'zustand';

import { ApkUpdaterPlugin } from '../services/apkUpdater';
import { Logger } from '../services/logger';
import { isTauriEnvironment } from '../services/universalStore';
import { errorMessage } from '../utils/errorMessage';
import { reportError } from '../utils/logging';
import { getSetting } from './settingsStore';

const CURRENT_VERSION = '1.47.51';
const GITHUB_REPO = 'danidetenerife/nucelar';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

type GitHubAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

type GitHubRelease = {
  tag_name: string;
  name: string;
  body: string;
  assets: GitHubAsset[];
};

type UpdaterState = {
  isUpdateAvailable: boolean;
  updateInfo: Update | null;
  androidApkUrl: string | null;
  newVersion: string | null;
  lastChecked: Date | null;
  isChecking: boolean;
  isDownloading: boolean;
  isInstalling: boolean;
  isReadyToRestart: boolean;
  downloadProgress: number;
  error: string | null;
  checkForUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  restartToUpdate: () => Promise<void>;
};

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  isUpdateAvailable: false,
  updateInfo: null,
  androidApkUrl: null,
  newVersion: null,
  lastChecked: null,
  isChecking: false,
  isDownloading: false,
  isInstalling: false,
  isReadyToRestart: false,
  downloadProgress: 0,
  error: null,

  checkForUpdate: async () => {
    const checkEnabled = getSetting('core.updates.checkForUpdates');
    if (checkEnabled === false) {
      return;
    }

    set({ isChecking: true, error: null });

    if (isTauriEnvironment()) {
      try {
        const update = await check();
        set({
          isUpdateAvailable: update !== null,
          updateInfo: update,
          newVersion: update?.version ?? null,
          lastChecked: new Date(),
          isChecking: false,
          error: null,
        });

        if (update !== null) {
          const autoInstall = getSetting('core.updates.autoInstall');
          if (autoInstall === true) {
            await get().downloadUpdate();
          }
        }
      } catch (error) {
        const message = errorMessage(error);
        Logger.updates.error(`Failed to check for updates: ${message}`);
        set({
          isChecking: false,
          lastChecked: new Date(),
          error: message,
        });
      }
      return;
    }

    // Android / Web / Mobile: check GitHub Releases API
    try {
      const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }

      const release: GitHubRelease = await response.json();
      const latestTag = release.tag_name.replace(/^v/, '');
      const currentClean = CURRENT_VERSION.replace(/^v/, '');

      const isNewer =
        semver.valid(latestTag) && semver.valid(currentClean)
          ? semver.gt(latestTag, currentClean)
          : latestTag !== currentClean;

      const apkAsset = release.assets?.find((asset) =>
        asset.name.toLowerCase().endsWith('.apk'),
      );

      if (isNewer && apkAsset) {
        set({
          isUpdateAvailable: true,
          androidApkUrl: apkAsset.browser_download_url,
          newVersion: release.tag_name,
          lastChecked: new Date(),
          isChecking: false,
          error: null,
        });

        const autoInstall = getSetting('core.updates.autoInstall');
        if (autoInstall === true) {
          await get().downloadUpdate();
        }
      } else {
        set({
          isUpdateAvailable: false,
          androidApkUrl: null,
          newVersion: null,
          lastChecked: new Date(),
          isChecking: false,
          error: null,
        });
      }
    } catch (error) {
      const message = errorMessage(error);
      Logger.updates.error(`Failed to check GitHub for updates: ${message}`);
      set({
        isChecking: false,
        lastChecked: new Date(),
        error: message,
      });
    }
  },

  downloadUpdate: async () => {
    const { updateInfo, androidApkUrl } = get();

    if (isTauriEnvironment() && updateInfo) {
      set({ isDownloading: true, downloadProgress: 0, error: null });
      let totalSize = 0;
      let downloadedSize = 0;
      try {
        await updateInfo.downloadAndInstall((event) => {
          if (event.event === 'Started' && event.data.contentLength) {
            totalSize = event.data.contentLength;
            set({ downloadProgress: 0 });
          } else if (event.event === 'Progress') {
            downloadedSize += event.data.chunkLength;
            const percentage =
              totalSize > 0
                ? Math.round((downloadedSize / totalSize) * 100)
                : 0;
            set({ downloadProgress: percentage });
          } else if (event.event === 'Finished') {
            set({
              isDownloading: false,
              isInstalling: false,
              isReadyToRestart: true,
              downloadProgress: 100,
            });
          }
        });
      } catch (error) {
        const message = errorMessage(error);
        Logger.updates.error(`Failed to download/install update: ${message}`);
        set({
          isDownloading: false,
          isInstalling: false,
          error: message,
        });
      }
      return;
    }

    if (androidApkUrl) {
      set({ isDownloading: true, downloadProgress: 0, error: null });
      try {
        let listenerHandle: { remove: () => void } | null = null;
        try {
          listenerHandle = await ApkUpdaterPlugin.addListener(
            'downloadProgress',
            (data) => {
              set({ downloadProgress: data.percent });
            },
          );
        } catch {
          // ignore
        }

        await ApkUpdaterPlugin.downloadAndInstall({ url: androidApkUrl });

        if (listenerHandle) {
          listenerHandle.remove();
        }

        set({
          isDownloading: false,
          isInstalling: false,
          isReadyToRestart: true,
          downloadProgress: 100,
        });
      } catch (error) {
        const message = errorMessage(error);
        Logger.updates.error(`Failed to download/install APK: ${message}`);
        set({
          isDownloading: false,
          isInstalling: false,
          error: message,
        });
      }
    }
  },

  restartToUpdate: async () => {
    if (isTauriEnvironment()) {
      try {
        await relaunch();
      } catch (error) {
        await reportError('updates', {
          userMessage: 'Failed to restart for update',
          error,
        });
        set({ error: errorMessage(error) });
      }
      return;
    }

    const { androidApkUrl } = get();
    if (androidApkUrl) {
      try {
        await ApkUpdaterPlugin.downloadAndInstall({ url: androidApkUrl });
      } catch (error) {
        set({ error: errorMessage(error) });
      }
    }
  },
}));
