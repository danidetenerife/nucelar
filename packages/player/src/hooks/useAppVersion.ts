import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useState } from 'react';

import { Logger } from '../services/logger';
import { isTauriEnvironment } from '../services/universalStore';

export const COMMIT_HASH = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : '';

export const useAppVersion = () => {
  const [version, setVersion] = useState<string | null>('1.47.1');

  useEffect(() => {
    if (!isTauriEnvironment()) {
      return;
    }
    getVersion()
      .then(setVersion)
      .catch((error) => {
        Logger.app.error(`Failed to get app version: ${error}`);
      });
  }, []);

  return {
    version,
    commitHash: COMMIT_HASH,
  };
};
