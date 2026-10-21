import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Forklift, HardHat, Megaphone, ShieldCheck, Warehouse, Zap, Lock, LifeBuoy, ArrowRight, Search, FileText, CreditCard, ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { EMPTY_FILTERS, buildSearchQuery } from '../lib/searchFilters';
import { listingTypeLabel } from '../lib/format';
import { PARTNER_APP_URL } from '../auth/AuthContext';
import type { CategoryDTO, ListingSummaryDTO, PlatformSettingsDTO } from '../lib/types';
import { ListingCard } from '../components/ListingCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/Skeleton';

const HeroScene = lazy(() => import('../components/HeroScene'));

const TYPE_TABS = ['', 'WAREHOUSE', 'EQUIPMENT', 'SERVICE'] as const;

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: 'Verified partners',
    body: 'Every partner goes through KYC and document checks before their listings go live.',
  },
  {
    icon: Zap,
    title: 'Live quotes',
    body: 'See subtotal, platform fee and taxes instantly — before you request a booking.',
  },
  {
    icon: Lock,
    title: 'Sandbox-secured payments',
    body: 'Pay only after the partner accepts. Every payment generates a GST-ready invoice.',
  },
  {
    icon: LifeBuoy,
    title: 'Dispute support',
    body: 'If something goes wrong, open a dispute and our team reviews it with both parties.',
  },
];

const TYPE_ICONS = {
  WAREHOUSE: Warehouse,
  EQUIPMENT: Forklift,
  SERVICE: HardHat,
} as const;

const TITLE_WORDS = ['Find', 'warehouses,', 'equipment', '&', 'logistics', 'services'];

const STEPS = [
  {
    icon: Search,
    title: 'Search & compare',
    body: 'Filter by city, type and capacity. Every listing shows verified partner info and live availability.',
  },
  {
    icon: FileText,
    title: 'Get a live quote',
    body: 'Subtotal, platform fee and taxes appear instantly — before you request a booking.',
  },
  {
    icon: CreditCard,
    title: 'Book & pay securely',
    body: 'Pay only after the partner accepts. Track the booking and get a GST-ready invoice.',
  },
];

const wordVariant = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

/**
 * Decide whether the 3D hero scene can run. Conservative: mobile, reduced
 * motion, low device memory, data-saver, or no WebGL fall back to the CSS
 * visual (which is always rendered while `mode === 'check'`).
 */
function useHeroSceneMode(): 'check' | '3d' | 'fallback' {
  const [mode, setMode] = useState<'check' | '3d' | 'fallback'>('check');
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.innerWidth < 768;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const lowPower = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
    const saveData = nav.connection?.saveData === true;
    let webgl: boolean;
    try {
      webgl = Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
      webgl = false;
    }
    setMode(!reduced && !mobile && !lowPower && !saveData && webgl ? '3d' : 'fallback');
  }, []);
  return mode;
}

export function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<(typeof TYPE_TABS)[number]>('');
  const sceneMode = useHeroSceneMode();

  useDocumentMeta({
    title: 'BookMyWarehouse — Warehouses, Equipment & Logistics Services in India',
    description:
      'Discover and book verified warehouses, forklifts and logistics services across India. Compare live quotes, book online and get GST-ready invoices.',
  });

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

  const categoryList = categories.data ?? [];

  return (
    <div className="home-page">
      <section className="hero">
        <div className="container hero-inner hero-grid">
          <div className="hero-copy">
            <p className="hero-eyebrow">
              <span aria-hidden="true">◆</span> India&apos;s logistics marketplace
            </p>
            <motion.h1
              className="hero-title"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } } }}
            >
              {TITLE_WORDS.map((word, index) => (
                <motion.span key={`${word}-${index}`} variants={wordVariant}>
                  {word}{' '}
                </motion.span>
              ))}
              <motion.span className="grad" variants={wordVariant}>
                near you
              </motion.span>
            </motion.h1>
            <p className="hero-subtitle">
              Compare verified listings, get live quotes with taxes up-front, and book with
              confidence.
            </p>

            <form className="hero-search" onSubmit={onSearch} role="search">
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
                  <Search size={17} aria-hidden="true" />
                  Search
                </button>
              </div>
            </form>

            <div className="hero-trust" aria-label="Why book with us">
              <span className="hero-trust-chip">
                <ShieldCheck size={14} aria-hidden="true" /> KYC-verified partners
              </span>
              <span className="hero-trust-chip">
                <Zap size={14} aria-hidden="true" /> Instant live quotes
              </span>
              <span className="hero-trust-chip">
                <Lock size={14} aria-hidden="true" /> GST-ready invoices
              </span>
            </div>

            {settings.data?.announcement ? (
              <div className="announcement" role="status">
                <Megaphone size={16} aria-hidden="true" /> {settings.data.announcement}
              </div>
            ) : null}
          </div>

          <div className="hero-scene">
            {sceneMode === '3d' ? (
              <Suspense
                fallback={
                  <div className="hero-scene-fallback" aria-hidden="true">
                    <Warehouse size={64} />
                  </div>
                }
              >
                <HeroScene />
              </Suspense>
            ) : (
              <div className="hero-scene-fallback" aria-hidden="true">
                <Warehouse size={64} />
              </div>
            )}
          </div>
        </div>
      </section>

      {categoryList.length > 0 ? (
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <div className="ticker-group" key={copy}>
                {categoryList.map((category) => (
                  <span key={`${copy}-${category.id}`} className="ticker-item">
                    <span className="ticker-dot" />
                    {category.name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <section className="section container reveal" aria-labelledby="categories-heading">
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
          <EmptyState
            title="No categories yet"
            message="Categories will appear once they are published."
          />
        ) : (
          <div className="grid grid-categories">
            {(categories.data ?? []).map((category) => {
              const CategoryIcon = TYPE_ICONS[category.type] ?? Warehouse;
              return (
                <Link
                  key={category.id}
                  to={`/search?categoryId=${category.id}&type=${category.type}`}
                  className="card category-card"
                >
                  <span className="category-icon" aria-hidden="true">
                    <CategoryIcon size={26} />
                  </span>
                  <div>
                    <h3 className="category-name">{category.name}</h3>
                    {category.description ? (
                      <p className="category-desc">{category.description}</p>
                    ) : null}
                    <span className="category-count">
                      {listingTypeLabel(category.type)}
                      {typeof category.listingCount === 'number'
                        ? ` · ${category.listingCount} listing${category.listingCount === 1 ? '' : 's'}`
                        : ''}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="section container reveal" aria-labelledby="featured-heading">
        <div className="section-head">
          <h2 id="featured-heading">Featured listings</h2>
          <Link to="/search?sort=rating_desc" className="link-btn">
            View all <ArrowRight size={14} aria-hidden="true" style={{ verticalAlign: -2 }} />
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

      <section className="section container reveal" aria-labelledby="how-heading">
        <div className="section-head section-head-center">
          <h2 id="how-heading">Book in three steps</h2>
          <p className="section-sub">From first search to paid invoice — nothing hidden in between.</p>
        </div>
        <ol className="how-grid">
          {STEPS.map((step, index) => (
            <li className="how-step" key={step.title}>
              <span className="how-num" aria-hidden="true">
                {index + 1}
              </span>
              <span className="how-icon" aria-hidden="true">
                <step.icon size={22} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section value-props reveal" aria-labelledby="why-heading">
        <div className="container">
          <div className="section-head section-head-center">
            <h2 id="why-heading">Why BookMyWarehouse?</h2>
          </div>
          <div className="grid grid-props">
            {VALUE_PROPS.map((prop) => (
              <div className="prop-card" key={prop.title}>
                <span className="prop-icon" aria-hidden="true">
                  <prop.icon size={20} />
                </span>
                <h3>{prop.title}</h3>
                <p>{prop.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="partner-cta container reveal" aria-labelledby="partner-cta-heading">
        <div className="partner-cta-card">
          <div className="partner-cta-copy">
            <span className="partner-cta-kicker">For partners</span>
            <h2 id="partner-cta-heading">Have space, equipment or a crew?</h2>
            <p>
              List on BookMyWarehouse, pass KYC once, and get booking requests from businesses
              across India — on your schedule.
            </p>
          </div>
          <a className="btn btn-on-brand btn-lg" href={PARTNER_APP_URL}>
            List your space <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
}
