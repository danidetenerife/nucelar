import { registerPlugin } from '@capacitor/core';

type YtStreamExtractorPluginInterface = {
  extractAudioUrl(options: { videoId: string }): Promise<{ streamUrl: string }>;
};

export const YtStreamExtractor = registerPlugin<YtStreamExtractorPluginInterface>(
  'YtStreamExtractor',
);
