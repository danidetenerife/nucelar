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
    <div className="border-border bg-primary shadow-shadow relative m-4 rounded-md border-(length:--border-width) p-6">
      <ConnectedFavoriteButton
        type="artist"
        source={{ provider: providerId, id: artistId }}
        data={{ name: artist.name, artwork: artist.artwork }}
        className="bg-background border-border absolute top-4 right-4 z-10 rounded-md border-(length:--border-width)"
        data-testid="artist-favorite-button"
      />
      <div className="flex items-center gap-5">
        {avatar && (
          <img
            className="border-border shadow-shadow h-24 w-24 shrink-0 rounded-full border-(length:--border-width) object-cover"
            src={avatar.url}
            alt={`${artist.name} avatar`}
          />
        )}
        <h1 className="font-heading min-w-0 pr-10 text-3xl font-extrabold leading-tight tracking-tight">
          {artist.name}
        </h1>
      </div>
    </div>
  );
};
