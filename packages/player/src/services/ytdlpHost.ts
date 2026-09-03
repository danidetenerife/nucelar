import { invoke } from '@tauri-apps/api/core';

import type {
  YtdlpHost,
  YtdlpPlaylistInfo,
  YtdlpSearchResult,
  YtdlpStreamInfo,
} from '@nuclearplayer/plugin-sdk';

import { httpHost } from './httpHost';
import { isCapacitorEnvironment, isTauriEnvironment } from './universalStore';
import { YtStreamExtractor } from './ytStreamExtractor';

const DEFAULT_VISITOR_ID =
  'CgtYZnFWT1lsZHNsOCj3wOLUBjIoCgJFUxIiEh4SHAsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicgLA%3D%3D';
let cachedVisitorData = DEFAULT_VISITOR_ID;

async function getVisitorData(): Promise<string> {
  try {
    const res = await httpHost.fetch('https://www.youtube.com/youtubei/v1/visitor_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20240901.01.00',
        Origin: 'https://www.youtube.com',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240901.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
      }),
    });

    if (res.status === 200 && res.body) {
      const data = JSON.parse(res.body);
      const visitor = data.responseContext?.visitorData;
      if (typeof visitor === 'string' && visitor.length > 5) {
        cachedVisitorData = visitor;
        return cachedVisitorData;
      }
    }
  } catch {
    // ignore
  }
  return cachedVisitorData;
}

async function extractAudioStreamDirect(videoId: string): Promise<YtdlpStreamInfo | null> {
  const visitorData = cachedVisitorData || DEFAULT_VISITOR_ID;
  void getVisitorData();

  const body = {
    context: {
      client: {
        clientName: 'VISIONOS',
        clientVersion: '1.02',
        deviceMake: 'Apple',
        deviceModel: 'RealityDevice17,1',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        osName: 'visionOS',
        osVersion: '26.5.23O471',
        hl: 'en',
      },
    },
    videoId,
    playbackContext: {
      contentPlaybackContext: {
        html5Preference: 'HTML5_PREF_WANTS',
        signatureTimestamp: 20696,
      },
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    'X-YouTube-Client-Name': '101',
    'X-YouTube-Client-Version': '1.02',
    Origin: 'https://www.youtube.com',
    ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
  };

  try {
    const res = await httpHost.fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (res.status < 200 || res.status >= 300 || !res.body) {
      return null;
    }

    const data = JSON.parse(res.body);
    const hlsManifestUrl = data.streamingData?.hlsManifestUrl;
    let audioUrl = hlsManifestUrl;

    if (hlsManifestUrl) {
      try {
        const m3u8Res = await httpHost.fetch(hlsManifestUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (m3u8Res.status === 200 && m3u8Res.body) {
          const lines = m3u8Res.body.split('\n');
          const audioLine = lines.find((l: string) => l.includes('sgoap/clen') && l.includes('URI='));
          const match = audioLine ? audioLine.match(/URI="([^"]+)"/) : null;
          if (match && match[1]) {
            audioUrl = match[1];
          }
        }
      } catch {
        // use hlsManifestUrl
      }
    }

    if (audioUrl) {
      const durationSec = data.videoDetails?.lengthSeconds
        ? Number(data.videoDetails.lengthSeconds)
        : null;

      return {
        stream_url: audioUrl,
        duration: durationSec,
        title: data.videoDetails?.title ?? null,
        container: 'm4a',
        codec: 'aac',
        album: null,
        artists: data.videoDetails?.author ? [data.videoDetails.author] : [],
        album_artists: [],
        upload_date: null,
      };
    }
  } catch (error) {
    console.warn('[ytdlpHost] Direct VISIONOS HLS extraction failed:', error);
  }
  return null;
}

export const ytdlpHost: YtdlpHost = {
  search: async (
    query: string,
    maxResults?: number,
  ): Promise<YtdlpSearchResult[]> => {
    if (!isTauriEnvironment()) {
      return [];
    }
    return invoke<YtdlpSearchResult[]>('ytdlp_search', {
      query,
      maxResults: maxResults ?? 10,
    });
  },

  getStream: async (url: string): Promise<YtdlpStreamInfo> => {
    let videoId = url;
    const match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    );
    if (match && match[1]) {
      videoId = match[1];
    }

    const directInfo = await extractAudioStreamDirect(videoId);
    if (directInfo) {
      return directInfo;
    }

    if (isTauriEnvironment()) {
      return invoke<YtdlpStreamInfo>('ytdlp_get_stream', { url });
    }

    if (isCapacitorEnvironment()) {
      try {
        const { streamUrl } = await YtStreamExtractor.extractAudioUrl({ videoId });
        if (streamUrl) {
          return {
            stream_url: streamUrl,
            duration: null,
            title: null,
            container: streamUrl.includes('webm') ? 'webm' : 'm4a',
            codec: streamUrl.includes('webm') ? 'opus' : 'aac',
            album: null,
            artists: [],
            album_artists: [],
            upload_date: null,
          };
        }
      } catch (error) {
        console.warn('[ytdlpHost] WebView extraction fallback failed:', error);
        throw new Error(
          `No se pudo resolver un stream de audio reproducible para ${videoId}`,
        );
      }
    }

    throw new Error(`No se pudo resolver un stream de audio reproducible para ${videoId}`);
  },

  getPlaylist: async (url: string): Promise<YtdlpPlaylistInfo> => {
    if (!isTauriEnvironment()) {
      return { id: '', title: '', entries: [] };
    }
    return invoke<YtdlpPlaylistInfo>('ytdlp_get_playlist', { url });
  },
};
