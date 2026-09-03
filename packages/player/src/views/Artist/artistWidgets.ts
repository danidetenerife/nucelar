import { FC } from 'react';

import type { ArtistMetadataCapability } from '@nuclearplayer/plugin-sdk';

import { ArtistAlbumsGrid } from './components/ArtistAlbumsGrid';
import { ArtistBioHeader } from './components/ArtistBioHeader';
import { ArtistPlaylistsGrid } from './components/ArtistPlaylistsGrid';
import { ArtistPopularTracks } from './components/ArtistPopularTracks';
import { ArtistSimilarArtists } from './components/ArtistSimilarArtists';

export type ArtistWidgetProps = {
  providerId: string;
  artistId: string;
};

export type ArtistWidgetEntry = {
  capability: ArtistMetadataCapability;
  component: FC<ArtistWidgetProps>;
  group?: string;
  width?: string;
};

export const ARTIST_WIDGETS: ArtistWidgetEntry[] = [
  { capability: 'artistBio', component: ArtistBioHeader },
  { capability: 'artistTopTracks', component: ArtistPopularTracks },
  { capability: 'artistAlbums', component: ArtistAlbumsGrid },
  {
    capability: 'artistRelatedArtists',
    component: ArtistSimilarArtists,
    group: 'related-and-playlists',
    width: 'md:w-1/2',
  },
  {
    capability: 'artistPlaylists',
    component: ArtistPlaylistsGrid,
    group: 'related-and-playlists',
    width: 'md:w-1/2',
  },
];

export type WidgetGroup = {
  key: string;
  entries: ArtistWidgetEntry[];
};

export const groupWidgets = (widgets: ArtistWidgetEntry[]): WidgetGroup[] => {
  const groups: WidgetGroup[] = [];

  for (const widget of widgets) {
    const lastGroup = groups[groups.length - 1];
    if (
      widget.group &&
      lastGroup &&
      lastGroup.entries[0]?.group === widget.group
    ) {
      lastGroup.entries.push(widget);
    } else {
      groups.push({
        key: widget.group ?? widget.capability,
        entries: [widget],
      });
    }
  }

  return groups;
};
