import { CellContext } from '@tanstack/react-table';
import { Music } from 'lucide-react';
import { useState } from 'react';

import { Artwork, Track } from '@nuclearplayer/model';

export const ThumbnailCell = <T extends Track>({
  getValue,
}: CellContext<T, Artwork>) => {
  const artworkUrl = getValue()?.url;
  const [hasError, setHasError] = useState(false);

  return (
    <td className="w-10 text-center">
      <div className="flex w-full justify-center">
        {artworkUrl && !hasError ? (
          <img
            className="w-10 min-w-10 rounded object-cover"
            src={artworkUrl}
            alt=""
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="bg-background-secondary text-foreground-secondary flex h-10 w-10 min-w-10 items-center justify-center rounded">
            <Music size={16} />
          </div>
        )}
      </div>
    </td>
  );
};
