import { useMemo, useState } from 'react';

import type { PlaylistIndexEntry } from '@nuclearplayer/model';

export const usePlaylistFilter = (playlists: PlaylistIndexEntry[]) => {
  const [filter, setFilter] = useState('');
  const query = filter.trim().toLowerCase();

  const filteredPlaylists = useMemo(() => {
    // Deduplicate by name first
    const seen = new Set<string>();
    const unique = (playlists || []).filter((p) => {
      if (!p || !p.name) return false;
      const name = p.name.toLowerCase().trim();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });

    if (query.length === 0) {
      return unique;
    }
    return unique.filter((playlist) =>
      playlist.name.toLowerCase().includes(query),
    );
  }, [playlists, query]);

  return {
    filter,
    setFilter,
    filteredPlaylists,
    hasFilter: query.length > 0,
  };
};
