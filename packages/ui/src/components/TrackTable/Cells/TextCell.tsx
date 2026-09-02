import { CellContext } from '@tanstack/react-table';

import { Track } from '@nuclearplayer/model';
import { cn } from '@nuclearplayer/ui';

type ClickableMeta = {
  onArtistClick?: (artistName: string, track: Track) => void;
  onAlbumClick?: (albumTitle: string, track: Track) => void;
};

export const TextCell = <T extends Track>(context: CellContext<T, string | number | undefined>) => {
  const { getValue, column, row, table } = context;
  const value = getValue();
  const meta = table.options.meta as ClickableMeta | undefined;
  const track = row.original;

  const isArtist = column.id === 'artist';
  const isAlbum = column.id === 'album';

  const clickHandler = isArtist && meta?.onArtistClick && value
    ? () => meta.onArtistClick!(String(value), track as unknown as Track)
    : isAlbum && meta?.onAlbumClick && value
      ? () => meta.onAlbumClick!(String(value), track as unknown as Track)
      : undefined;

  return (
    <td
      className={cn(
        'truncate px-2',
        isArtist && 'hidden sm:table-cell',
        clickHandler ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      {clickHandler ? (
        <button
          type="button"
          className="truncate text-left hover:underline focus:outline-none w-full"
          onClick={(event) => {
            event.stopPropagation();
            clickHandler();
          }}
        >
          {value}
        </button>
      ) : (
        <div className="truncate">{value}</div>
      )}
    </td>
  );
};
