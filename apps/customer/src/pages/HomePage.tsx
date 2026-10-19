import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { EMPTY_FILTERS, buildSearchQuery } from '../lib/searchFilters';
import { listingTypeLabel } from '../lib/format';
import type { CategoryDTO, ListingSummaryDTO, PlatformSettingsDTO } from '../lib/types';
import { ListingCard } from '../components/ListingCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/Skeleton';

const TYPE_TABS = ['', 'WAREHOUSE', 'EQUIPMENT', 'SERVICE'] as const;

const VALUE_PROPS = [
  {
    icon: '✓',
    title: 'Verified partners',
    body: 'Every partner goes through KYC and document checks before their listings go live.',
  },
  {
    icon: '⚡',
    title: 'Live quotes',
    body: 'See subtotal, platform fee and taxes instantly — before you request a booking.',
  },
  {
    icon: '🔒',
    title: 'Sandbox-secured payments',
    body: 'Pay only after the partner accepts. Every payment generates a GST-ready invoice.',
  },
  {
    icon: '🛡️',
    title: 'Dispute support',
    body: 'If something goes wrong, open a dispute and our team reviews it with both parties.',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<(typeof TYPE_TABS)[number]>('');

  const settings = useAsyncData<PlatformSettingsDTO>(() => api.get('/catalog/settings'), []);
  // `GET /catalog/categories` answers with a pagination envelope `{ items }`.
  const categories = useAsyncData<CategoryDTO[]>(
    async () => (await api.get<{ items: CategoryDTO[] }>('/catalog/categories')).items,
    [],
  );
  const featured = useAsyncData<{ items: ListingSummaryDTO[] }>(
    () => api.get('/catalog/listings', { limit: 8, sort: 'rating_desc' }),
    [],
  );

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const filters = { ...EMPTY_FILTERS, q: keyword.trim(), city: city.trim(), type };
    navigate(`/search?${buildSearchQuery(filters).toString()}`);
  };

  return (
    <div className="home-page">
      <section className="hero">
        <div className="container hero-inner">
          <h1 className="hero-title">Find warehouses, equipment &amp; logistics services near you</h1>
          <p className="hero-subtitle">
            Compare verified listings, get live quotes with taxes up-front, and book with confidence.
          </p>

          <form className="hero-search card" onSubmit={onSearch} role="search">
            <div className="hero-tabs" role="tablist" aria-label="Listing type">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab || 'ALL'}
                  type="button"
                  role="tab"
                  aria-selected={type === tab}
                  className={`hero-tab ${type === tab ? 'is-active' : ''}`}
                  onClick={() => setType(tab)}
                >
                  {tab ? listingTypeLabel(tab) : 'All'}
                </button>
              ))}
            </div>
            <div className="hero-fields">
              <div className="field">
                <label htmlFor="hero-keyword">What are you looking for?</label>
                <input
                  id="hero-keyword"
                  className="input"
                  type="search"
                  placeholder="Cold storage, forklift hire, packing crew…"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="hero-city">City</label>
                <input
                  id="hero-city"
                  className="input"
                  type="text"
                  placeholder="e.g. Pune"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg hero-submit">
                Search
              </button>
            </div>
          </form>

          {settings.data?.announcement ? (
            <div className="announcement" role="status">
              <span aria-hidden="true">📣</span> {settings.data.announcement}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section container" aria-labelledby="categories-heading">
        <div className="section-head">
          <h2 id="categories-heading">Browse by category</h2>
        </div>
        {categories.loading ? (
          <div className="grid grid-categories">
            {Array.from({ length: 4 }, (_, i) => (
              <div className="card category-card" key={i}>
                <div className="skeleton" style={{ height: 20, width: '60%' }} />
                <div className="skeleton" style={{ height: 14, width: '90%', marginTop: 10 }} />
              </div>
            ))}
          </div>
        ) : categories.error ? (
          <ErrorState message={categories.error.message} onRetry={categories.reload} />
        ) : (categories.data ?? []).length === 0 ? (
          <EmptyState title="No categories yet" message="Categories will appear once they are published." />
        ) : (
          <div className="grid grid-categories">
            {(categories.data ?? []).map((category) => (
              <Link
                key={category.id}
                to={`/search?categoryId=${category.id}&type=${category.type}`}
                className="card category-card"
              >
                <span className="category-icon" aria-hidden="true">
                  {category.type === 'WAREHOUSE' ? '🏭' : category.type === 'EQUIPMENT' ? '🚜' : '👷'}
                </span>
                <div>
                  <h3 className="category-name">{category.name}</h3>
                  {category.description ? <p className="category-desc">{category.description}</p> : null}
                  <span className="category-count">
                    {listingTypeLabel(category.type)}
                    {typeof category.listingCount === 'number' ? ` · ${category.listingCount} listing${category.listingCount === 1 ? '' : 's'}` : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section container" aria-labelledby="featured-heading">
        <div className="section-head">
          <h2 id="featured-heading">Featured listings</h2>
          <Link to="/search?sort=rating_desc" className="link-btn">
            View all →
          </Link>
        </div>
        {featured.loading ? (
          <SkeletonGrid count={4} />
        ) : featured.error ? (
          <ErrorState message={featured.error.message} onRetry={featured.reload} />
        ) : (featured.data?.items ?? []).length === 0 ? (
          <EmptyState
            title="No listings yet"
            message="Once partners publish listings, the best rated ones will show up here."
            action={
              <Link to="/search" className="btn btn-outline">
                Explore the marketplace
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cards">
            {(featured.data?.items ?? []).map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="section value-props" aria-labelledby="why-heading">
        <div className="container">
          <div className="section-head section-head-center">
            <h2 id="why-heading">Why BookMyWarehouse?</h2>
          </div>
          <div className="grid grid-props">
            {VALUE_PROPS.map((prop) => (
              <div className="prop-card" key={prop.title}>
                <span className="prop-icon" aria-hidden="true">
                  {prop.icon}
                </span>
                <h3>{prop.title}</h3>
                <p>{prop.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
