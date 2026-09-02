import type { FetchFunction } from '@nuclearplayer/plugin-sdk';

import type { DecodedSecret } from './totp';
import {
  decodeIntArraySecret,
  decodeStringSecret,
  ENCODED_SECRETS,
  generateTotp,
  TOTP_LOCAL_PERIOD,
  TOTP_SERVER_PERIOD,
} from './totp';

const decode = (encoded: string): string => atob(encoded);

type TokenResponse = {
  accessToken: string;
  accessTokenExpirationTimestampMs: number;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

type RemoteSecretsDict = Record<string, number[]>;

type RemoteSecretsCache = {
  data: RemoteSecretsDict;
  fetchedAt: number;
};

const TOKEN_URL = decode('aHR0cHM6Ly9vcGVuLnNwb3RpZnkuY29tL2FwaS90b2tlbg==');
const SERVER_TIME_URL = decode('aHR0cHM6Ly9vcGVuLnNwb3RpZnkuY29tL2FwaS9zZXJ2ZXItdGltZQ==');
const REMOTE_SECRETS_URL =
  'https://raw.githubusercontent.com/xyloflake/spot-secrets-go/refs/heads/main/secrets/secretDict.json';
const REMOTE_SECRETS_CACHE_MS = 60 * 60 * 1000;
const MAX_SECRET_RETRIES = 5;

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: decode('aHR0cHM6Ly9vcGVuLnNwb3RpZnkuY29t'),
  Referer: decode('aHR0cHM6Ly9vcGVuLnNwb3RpZnkuY29tLw=='),
};

export class AuthClient {
  private cachedToken: CachedToken | null = null;
  private cachedDecodedSecret: DecodedSecret | null = null;
  private cachedRemoteSecrets: RemoteSecretsCache | null = null;
  private pendingTokenRequest: Promise<string> | null = null;
  private failedSecretVersions: Set<number> = new Set();

  constructor(private readonly fetch: FetchFunction) {}

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && !this.isTokenExpired()) {
      return this.cachedToken.accessToken;
    }

    return this.deduplicatedTokenFetch();
  }

  async refreshAccessToken(): Promise<string> {
    if (this.cachedDecodedSecret) {
      this.failedSecretVersions.add(this.cachedDecodedSecret.version);
    }
    this.cachedToken = null;
    this.cachedDecodedSecret = null;

    return this.deduplicatedTokenFetch();
  }

  private deduplicatedTokenFetch(): Promise<string> {
    if (this.pendingTokenRequest) {
      return this.pendingTokenRequest;
    }
    this.pendingTokenRequest = this.fetchAccessToken().finally(() => {
      this.pendingTokenRequest = null;
    });
    return this.pendingTokenRequest;
  }

  private async fetchAccessToken(retryCount = 0): Promise<string> {
    if (retryCount >= MAX_SECRET_RETRIES) {
      throw new Error('All TOTP secrets failed - unable to obtain access token');
    }

    const decodedSecret = await this.getValidSecret();
    const serverTimeSec = await this.getServerTime();
    const localTimeSec = Math.floor(Date.now() / 1000);

    const totp = await generateTotp(decodedSecret.hexSecret, localTimeSec, TOTP_LOCAL_PERIOD);
    const totpServer = await generateTotp(decodedSecret.hexSecret, serverTimeSec, TOTP_SERVER_PERIOD);

    const url = new URL(TOKEN_URL);
    url.searchParams.set('reason', 'init');
    url.searchParams.set('productType', 'web-player');
    url.searchParams.set('totp', totp);
    url.searchParams.set('totpVer', decodedSecret.version.toString());
    url.searchParams.set('totpServer', totpServer);

    const response = await this.fetch(url.toString(), { headers: BROWSER_HEADERS });

    if (!response.ok) {
      this.failedSecretVersions.add(decodedSecret.version);
      this.cachedDecodedSecret = null;
      return this.fetchAccessToken(retryCount + 1);
    }

    const data = (await response.json()) as TokenResponse;
    this.cachedToken = {
      accessToken: data.accessToken,
      expiresAt: data.accessTokenExpirationTimestampMs,
    };
    this.failedSecretVersions.clear();

    return data.accessToken;
  }

  private async getValidSecret(): Promise<DecodedSecret> {
    if (this.cachedDecodedSecret && !this.failedSecretVersions.has(this.cachedDecodedSecret.version)) {
      return this.cachedDecodedSecret;
    }

    for (const entry of ENCODED_SECRETS) {
      if (this.failedSecretVersions.has(entry.version)) {
        continue;
      }
      const hexSecret = decodeStringSecret(entry.secret);
      this.cachedDecodedSecret = { hexSecret, version: entry.version };
      return this.cachedDecodedSecret;
    }

    const remoteSecrets = await this.fetchRemoteSecrets();
    const versions = Object.keys(remoteSecrets)
      .map(Number)
      .sort((left, right) => right - left);

    for (const version of versions) {
      if (this.failedSecretVersions.has(version)) {
        continue;
      }
      const values = remoteSecrets[version.toString()];
      if (!values) {
        continue;
      }
      const hexSecret = decodeIntArraySecret(values);
      this.cachedDecodedSecret = { hexSecret, version };
      return this.cachedDecodedSecret;
    }

    throw new Error('No valid TOTP secret found - all secrets exhausted');
  }

  private async fetchRemoteSecrets(): Promise<RemoteSecretsDict> {
    if (
      this.cachedRemoteSecrets &&
      Date.now() - this.cachedRemoteSecrets.fetchedAt < REMOTE_SECRETS_CACHE_MS
    ) {
      return this.cachedRemoteSecrets.data;
    }

    const response = await this.fetch(REMOTE_SECRETS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote secrets: ${response.status}`);
    }

    const data = (await response.json()) as RemoteSecretsDict;
    this.cachedRemoteSecrets = { data, fetchedAt: Date.now() };
    return data;
  }

  private async getServerTime(): Promise<number> {
    const response = await this.fetch(SERVER_TIME_URL, { headers: BROWSER_HEADERS });
    if (!response.ok) {
      throw new Error(`Failed to fetch server time: ${response.status}`);
    }

    const data = (await response.json()) as { serverTime: number };
    return data.serverTime;
  }

  private isTokenExpired(): boolean {
    if (!this.cachedToken) {
      return true;
    }
    return Date.now() >= this.cachedToken.expiresAt;
  }
}
