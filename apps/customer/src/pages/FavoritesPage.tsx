import { Link } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import type { FavoriteDTO, ListingSummaryDTO } from '../lib/types';
import { ListingCard } from '../components/ListingCard';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export function FavoritesPage() {
  const toast = useToast();
  const favorites = useAsyncData(
    () => api.getWithMeta<{ items: FavoriteDTO[] }>('/favorites', { limit: 24 }),
    [],
  );

  const onToggleFavorite = async (listing: ListingSummaryDTO) => {
    try {
      await api.post('/favorites', { listingId: listing.id });
      toast.push('Removed from favorites', 'success');
      favorites.reload();
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'Could not update favorites', 'error');
    }
  };

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Favorites</h1>
        <p className="muted">Listings you saved for later.</p>
      </div>

      {favorites.loading ? (
        <PageLoader label="Loading favorites…" />
      ) : favorites.error ? (
        <ErrorState message={favorites.error.message} onRetry={favorites.reload} />
      ) : (favorites.data?.data?.items ?? []).length === 0 ? (
        <EmptyState
          title="No favorites yet"
          message="Tap the heart on any listing to save it here."
          action={
            <Link to="/search" className="btn btn-primary">
              Explore listings
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cards">
          {(favorites.data?.data?.items ?? []).map((favorite) => (
            <ListingCard
              key={favorite.id}
              listing={{ ...favorite.listing, isFavorite: true }}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
