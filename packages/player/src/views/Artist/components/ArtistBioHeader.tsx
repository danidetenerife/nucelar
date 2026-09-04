import { FC } from 'react';

import { pickArtwork } from '@nuclearplayer/model';
import { Loader } from '@nuclearplayer/ui';

import { ConnectedFavoriteButton } from '../../../components/ConnectedFavoriteButton';
import { useArtistBio } from '../hooks/useArtistBio';
import { ArtistErrorBanner } from './ArtistErrorBanner';

const AVATAR_SIZE_PX = 300;

type ArtistBioHeaderProps = {
  providerId: string;
  artistId: string;
};

export const ArtistBioHeader: FC<ArtistBioHeaderProps> = ({
  providerId,
  artistId,
}) => {
  const {
    data: artist,
    isLoading,
    isError,
    error,
    refetch,
  } = useArtistBio(providerId, artistId);

  if (isLoading) {
    return (
      <div className="border-border bg-primary shadow-shadow m-4 flex items-center justify-center rounded-md border-(length:--border-width) p-6">
        <Loader size="xl" data-testid="artist-header-loader" />
      </div>
    );
  }

  if (isError) {
    return (
      <ArtistErrorBanner
        providerId={providerId}
        artistId={artistId}
        bioError={error}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!artist) {
    return null;
  }

  const avatar = pickArtwork(artist.artwork, 'avatar', AVATAR_SIZE_PX);

  return (
    <div className="border-border bg-primary shadow-shadow relative m-4 overflow-hidden rounded-md border-(length:--border-width) p-3 md:p-8">
      <ConnectedFavoriteButton
        type="artist"
        source={{ provider: providerId, id: artistId }}
        data={{ name: artist.name, artwork: artist.artwork }}
        className="bg-background border-border absolute top-3 right-3 z-10 rounded-md border-(length:--border-width) md:top-4 md:right-4"
        data-testid="artist-favorite-button"
      />
      <div className="flex items-center gap-3 md:gap-6">
        {avatar && (
          <img
            className="border-border shadow-shadow h-14 w-14 shrink-0 rounded-full border-(length:--border-width) object-cover md:h-36 md:w-36"
            src={avatar.url}
            alt={`${artist.name} avatar`}
          />
        )}
        <div className="flex min-w-0 flex-col gap-0.5 md:gap-2 pr-8 md:pr-0">
          <h1 className="font-heading text-xl font-extrabold leading-tight tracking-tight md:truncate md:text-6xl">
            {artist.name}
          </h1>
          {artist.disambiguation && (
            <span className="text-foreground-secondary truncate text-sm md:text-base">
              {artist.disambiguation}
            </span>
          )}
          {artist.tags && artist.tags.length > 0 && (
            <div className="mt-1 hidden flex-wrap gap-2 md:flex">
              {artist.tags.map((tag) => (
                <span
                  key={tag}
                  className="border-border bg-background rounded-md border px-2 py-0.5 text-sm font-bold"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
