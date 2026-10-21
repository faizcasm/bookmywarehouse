import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ApiError, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import type { FavoriteDTO, ListingSummaryDTO } from '../lib/types';
import { ListingCard } from '../components/ListingCard';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { fadeUp, stagger } from '@bmw/ui';

export function FavoritesPage() {
  const toast = useToast();

  useDocumentMeta({
    title: 'Favorites — BookMyWarehouse',
    description: 'Listings you saved for later.',
  });

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
      <motion.div className="page-head reveal" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1>Favorites</h1>
        <p className="muted">Listings you saved for later.</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {favorites.loading ? (
          <PageLoader key="loading" label="Loading favorites…" />
        ) : favorites.error ? (
          <ErrorState key="error" message={favorites.error.message} onRetry={favorites.reload} />
        ) : (favorites.data?.data?.items ?? []).length === 0 ? (
          <motion.div
            key="empty"
            className="state-block reveal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="state-icon" aria-hidden="true">
              ♡
            </div>
            <h3 className="state-title">No favorites yet</h3>
            <p className="state-message">Tap the heart on any listing to save it here.</p>
            <Link to="/search" className="btn btn-primary">
              Explore listings
            </Link>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="grid grid-cards"
            variants={stagger(0.07)}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence mode="popLayout">
              {(favorites.data?.data?.items ?? []).map((favorite) => (
                <motion.div key={favorite.id} variants={fadeUp}>
                  <ListingCard
                    listing={{ ...favorite.listing, isFavorite: true }}
                    onToggleFavorite={onToggleFavorite}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}