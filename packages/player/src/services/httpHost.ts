import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { invoke } from '@tauri-apps/api/core';

import type {
  HttpHost,
  HttpRequestInit,
  HttpResponseData,
} from '@nuclearplayer/plugin-sdk';

import { Logger } from './logger';
import { isTauriEnvironment } from './universalStore';

export const httpHost: HttpHost = {
  fetch: async (
    url: string,
    init?: HttpRequestInit,
  ): Promise<HttpResponseData> => {
    const method = init?.method ?? 'GET';
    Logger.http.debug(`${method} ${url}`);

    if (!isTauriEnvironment()) {
      try {
        if (Capacitor.isNativePlatform()) {
          const rawHeaders: Record<string, string> = {};
          if (init?.headers) {
            for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
              rawHeaders[k] = v;
            }
          }

          const capResponse = await CapacitorHttp.request({
            url,
            method,
            headers: rawHeaders,
            data: init?.body,
            responseType: 'text',
            connectTimeout: 10000,
            readTimeout: 10000,
          });

          const headersRecord: Record<string, string> = {};
          if (capResponse.headers) {
            for (const [k, v] of Object.entries(capResponse.headers)) {
              headersRecord[k] = String(v);
            }
          }

          const bodyStr =
            typeof capResponse.data === 'string'
              ? capResponse.data
              : JSON.stringify(capResponse.data);

          return {
            status: capResponse.status,
            headers: headersRecord,
            body: bodyStr,
          };
        }

        const response = await fetch(url, {
          method,
          headers: init?.headers,
          body: init?.body,
        });
        const text = await response.text();
        const headersRecord: Record<string, string> = {};
        response.headers.forEach((val, key) => {
          headersRecord[key] = val;
        });

        return {
          status: response.status,
          headers: headersRecord,
          body: text,
        };
      } catch (err) {
        Logger.http.error(`Fetch failed for ${url}: ${err}`);
        return {
          status: 500,
          headers: {},
          body: '',
        };
      }
    }

    const response = await invoke<HttpResponseData>('http_fetch', {
      request: {
        url,
        method,
        headers: init?.headers,
        body: init?.body,
      },
    });

    Logger.http.debug(`${method} ${url} -> ${response.status}`);

    return response;
  },
};
