import { invoke } from '@tauri-apps/api/core';

import type {
  YtdlpHost,
  YtdlpPlaylistInfo,
  YtdlpSearchResult,
  YtdlpStreamInfo,
} from '@nuclearplayer/plugin-sdk';

import { httpHost } from './httpHost';
import { isTauriEnvironment } from './universalStore';

let cachedVisitorId = '';
let cachedCookies = '';

async function ensureVisitorSession(videoId: string): Promise<void> {
  if (cachedVisitorId && cachedCookies) {
    return;
  }
  try {
    const pageRes = await httpHost.fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (pageRes.body) {
      const match = pageRes.body.match(/"VISITOR_DATA":"([^"]+)"/);
      if (match && match[1]) {
        cachedVisitorId = match[1];
      }
    }
    const setCookie = (pageRes.headers as Record<string, string>)?.['set-cookie'] || '';
    if (setCookie) {
      cachedCookies = setCookie
        .split(',')
        .map((part) => part.split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
    }
  } catch {
    // ignore
  }
}

async function extractAudioStreamDirect(videoId: string): Promise<YtdlpStreamInfo | null> {
  await ensureVisitorSession(videoId);

  const body = {
    context: {
      client: {
        clientName: 'ANDROID_VR',
        clientVersion: '1.65.10',
        deviceMake: 'Oculus',
        deviceModel: 'Quest 3',
        androidSdkVersion: 32,
        userAgent:
          'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
        osName: 'Android',
        osVersion: '12L',
        hl: 'en',
        gl: 'US',
      },
    },
    videoId,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent':
      'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    'X-YouTube-Client-Name': '28',
    'X-YouTube-Client-Version': '1.65.10',
    Origin: 'https://www.youtube.com',
  };

  if (cachedCookies) {
    headers.Cookie = cachedCookies;
  }
  if (cachedVisitorId) {
    headers['X-Goog-Visitor-Id'] = cachedVisitorId;
  }

  try {
    const res = await httpHost.fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (res.status < 200 || res.status >= 300 || !res.body) {
      return null;
    }

    const data = JSON.parse(res.body);
    const formats = data.streamingData?.adaptiveFormats || [];
    const audioFormats = formats.filter(
      (format: { mimeType?: string }) => format.mimeType && format.mimeType.includes('audio'),
    );

    audioFormats.sort(
      (a: { bitrate?: number; mimeType?: string }, b: { bitrate?: number; mimeType?: string }) => {
        const aIsM4a = a.mimeType?.includes('mp4') ? 1 : 0;
        const bIsM4a = b.mimeType?.includes('mp4') ? 1 : 0;
        if (aIsM4a !== bIsM4a) {
          return bIsM4a - aIsM4a;
        }
        return (b.bitrate || 0) - (a.bitrate || 0);
      },
    );

    for (const format of audioFormats) {
      if (format.url) {
        const approxDurationMs = format.approxDurationMs
          ? Number(format.approxDurationMs)
          : null;
        const durationSec = approxDurationMs ? approxDurationMs / 1000 : null;
        const container = format.mimeType.includes('mp4') ? 'm4a' : 'webm';
        const codecMatch = (format.mimeType as string).match(/codecs="([^"]+)"/);
        const codec = codecMatch ? codecMatch[1] : 'aac';

        return {
          stream_url: format.url,
          duration: durationSec,
          title: data.videoDetails?.title ?? null,
          container,
          codec,
          album: null,
          artists: data.videoDetails?.author ? [data.videoDetails.author] : [],
          album_artists: [],
          upload_date: null,
        };
      }
    }
  } catch (error) {
    console.warn('[ytdlpHost] Direct Android VR extraction failed:', error);
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

    return {
      stream_url: `https://www.youtube.com/watch?v=${videoId}`,
      duration: null,
      title: null,
      container: 'mp4',
      codec: 'aac',
      album: null,
      artists: [],
      album_artists: [],
      upload_date: null,
    };
  },

  getPlaylist: async (url: string): Promise<YtdlpPlaylistInfo> => {
    if (!isTauriEnvironment()) {
      return { id: '', title: '', entries: [] };
    }
    return invoke<YtdlpPlaylistInfo>('ytdlp_get_playlist', { url });
  },
};
