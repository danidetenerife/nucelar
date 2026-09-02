import type { PlaylistIndexEntry } from '@nuclearplayer/model';
import { playlistIndexSchema } from '@nuclearplayer/model';

import { createUniversalStore } from '../universalStore';
import { loadValidated } from '../validatedStore';

const PLAYLISTS_DIR = 'playlists';

export class PlaylistIndexStore {
  #store = createUniversalStore(`${PLAYLISTS_DIR}/index.json`);

  async load(): Promise<PlaylistIndexEntry[]> {
    const raw =
      (await loadValidated(
        this.#store,
        'entries',
        playlistIndexSchema,
        'playlists',
      )) ?? [];

    // Deduplicate by name and ID
    const seen = new Map<string, PlaylistIndexEntry>();
    for (const item of raw) {
      if (item && item.name) {
        const key = item.name.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.set(key, item);
        }
      }
    }

    const deduplicated = Array.from(seen.values());
    if (deduplicated.length !== raw.length) {
      void this.save(deduplicated);
    }
    return deduplicated;
  }

  async save(index: PlaylistIndexEntry[]): Promise<void> {
    const seen = new Map<string, PlaylistIndexEntry>();
    for (const item of index) {
      if (item && item.name) {
        const key = item.name.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.set(key, item);
        }
      }
    }
    const deduplicated = Array.from(seen.values());
    await this.#store.set('entries', deduplicated);
    await this.#store.save();
  }
}
