import type {
  NuclearPlugin,
  NuclearPluginAPI,
} from '@nuclearplayer/plugin-sdk';

import { YtMusicClient } from './client';
import {
  DASHBOARD_PROVIDER_ID,
  createDashboardProvider,
} from './dashboard-provider';
import {
  DISCOVERY_PROVIDER_ID,
  createDiscoveryProvider,
} from './discovery-provider';
import {
  METADATA_PROVIDER_ID,
  createMetadataProvider,
} from './metadata-provider';
import {
  PLAYLIST_PROVIDER_ID,
  createPlaylistProvider,
} from './playlist-provider';
import {
  STREAMING_PROVIDER_ID,
  createStreamingProvider,
} from './streaming-provider';

let ytMusicClient: YtMusicClient | undefined;

const getClient = (api: NuclearPluginAPI): YtMusicClient => {
  if (!ytMusicClient) {
    ytMusicClient = new YtMusicClient(api.Http.fetch);
  }
  return ytMusicClient;
};

const plugin: NuclearPlugin = {
  onEnable(api: NuclearPluginAPI) {
    const client = getClient(api);
    api.Providers.register(createStreamingProvider(api, client));
    api.Providers.register(createMetadataProvider(client));
    api.Providers.register(createDashboardProvider(api, client));
    api.Providers.register(createPlaylistProvider(client));
    api.Providers.register(createDiscoveryProvider(client));
  },

  onDisable(api: NuclearPluginAPI) {
    api.Providers.unregister(STREAMING_PROVIDER_ID);
    api.Providers.unregister(METADATA_PROVIDER_ID);
    api.Providers.unregister(DASHBOARD_PROVIDER_ID);
    api.Providers.unregister(PLAYLIST_PROVIDER_ID);
    api.Providers.unregister(DISCOVERY_PROVIDER_ID);
  },
};

export default plugin;
