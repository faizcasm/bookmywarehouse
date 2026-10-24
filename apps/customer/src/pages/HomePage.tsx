import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, FileText, CreditCard, ArrowRight, Warehouse, Forklift, HardHat, ShieldCheck, Zap, Lock, LifeBuoy, ArrowUpRight, ArrowRight as ArrowRightIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { EMPTY_FILTERS, buildSearchQuery } from '../lib/searchFilters';
import { listingTypeLabel } from '../lib/format';
import { PARTNER_APP_URL } from '../auth/AuthContext';
import type { CategoryDTO, ListingSummaryDTO, PlatformSettingsDTO } from '../lib/types';
import { ListingCard } from '../components/ListingCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/Skeleton';
import { HeroShowcase } from '../components/HeroShowcase';

const TYPE_TABS = ['', 'WAREHOUSE', 'EQUIPMENT', 'SERVICE'] as const;

const STEPS = [
  {
    step: '01',
    icon: Search,
    title: 'Discover Spaces & Services',
    body: 'Browse vetted warehouses, equipment, and logistics services with transparent specs, live availability, and verified partner info.',
  },
  {
    step: '02',
    icon: FileText,
    title: 'Compare Technical Specifications',
    body: 'Evaluate capacity, power, loading access, certifications, and standard rates. Every listing shows technical specs upfront.',
  },
  {
    step: '03',
    icon: CreditCard,
    title: 'Request a Hold & Direct COI',
    body: 'Submit a booking inquiry. Our facility coordinators confirm availability and coordinate automated insurance delivery.',
  },
];

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: 'KYC-Verified Partners',
    body: 'Every partner goes through document checks before their listings go live.',
  },
  {
    icon: Zap,
    title: 'Live Quotes Up-Front',
    body: 'Subtotal, platform fee and taxes — before you book.',
  },
  {
    icon: Lock,
    title: 'GST-Ready Invoices',
    body: 'Every payment generates a downloadable invoice.',
  },
  {
    icon: LifeBuoy,
    title: 'Dispute Support',
    body: 'If something goes wrong, open a dispute and our team reviews it with both parties.',
  },
];

const TYPE_ICONS = {
  WAREHOUSE: Warehouse,
  EQUIPMENT: Forklift,
  SERVICE: HardHat,
} as const;

const TITLE_WORDS = ['Find', 'warehouses,', 'equipment', '&', 'logistics', 'services'];

const wordVariant = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

export function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<(typeof TYPE_TABS)[number]>('');

  useDocumentMeta({
    title: 'BookMyWarehouse — Warehouses, Equipment & Logistics Services in India',
    description:
      'Discover and book verified warehouses, equipment and logistics services across India. Compare live quotes, book online and get GST-ready invoices.',
  });

  const settings = useAsyncData<PlatformSettingsDTO>(() => api.get('/catalog/settings'), []);
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
      {/* Hero Section - BookMyStudio style */}
      <section className="hero-section relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-blob" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-blob animation-delay-2000" />

        <div className="container relative pt-14 sm:pt-20 lg:pt-28 pb-14 sm:pb-20">
          <div className="hero-grid lg:grid lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            {/* Left: Copy */}
            <div className="lg:col-span-7 space-y-6 reveal stagger-0">
              <p className="hero-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                India's Production Logistics Marketplace
              </p>

              <motion.h1
                className="hero-title text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } } }}
              >
                {TITLE_WORDS.map((word, index) => (
                  <motion.span key={`${word}-${index}`} variants={wordVariant}>
                    {word}{' '}
                  </motion.span>
                ))}
                <motion.span className="text-emerald-600 dark:text-emerald-400" variants={wordVariant}>
                  near you
                </motion.span>
              </motion.h1>

              <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl reveal stagger-1">
                Compare verified listings, get live quotes with taxes up-front, and book with confidence.
              </p>

              {/* Search Form */}
              <form className="hero-search reveal stagger-2" onSubmit={onSearch} role="search">
                <div className="hero-tabs" role="tablist" aria-label="Listing type">
                  {TYPE_TABS.map((tab) => (
                    <button
                      key={tab || 'ALL'}
                      type="button"
                      role="tab"
                      aria-selected={type === tab}
                      className={`nav-pill ${type === tab ? 'nav-pill-active' : ''}`}
                      onClick={() => setType(tab)}
                    >
                      {tab ? listingTypeLabel(tab) : 'All'}
                    </button>
                  ))}
                </div>

                <div className="hero-fields grid sm:grid-cols-3 gap-3">
                  <div className="field">
                    <label htmlFor="hero-keyword" className="visually-hidden">What are you looking for?</label>
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
                    <label htmlFor="hero-city" className="visually-hidden">City</label>
                    <input
                      id="hero-city"
                      className="input"
                      type="text"
                      placeholder="e.g. Pune"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-brand btn-lg hero-submit w-full sm:w-auto">
                    <Search size={17} aria-hidden="true" />
                    Search
                  </button>
                </div>
              </form>

              {/* Trust chips */}
              <div className="flex flex-wrap gap-2 reveal stagger-3" aria-label="Why book with us">
                <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/30">
                  <ShieldCheck size={12} aria-hidden="true" className="mr-1" /> KYC-verified partners
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/30">
                  <Zap size={12} aria-hidden="true" className="mr-1" /> Instant live quotes
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/30">
                  <Lock size={12} aria-hidden="true" className="mr-1" /> GST-ready invoices
                </span>
              </div>

              {settings.data?.announcement ? (
                <div className="announcement" role="status">
                  <Zap size={16} aria-hidden="true" /> {settings.data.announcement}
                </div>
              ) : null}
            </div>

            {/* Right: showcase card (static — the 3D scene it replaced shipped
                its own WebGL bundle, capability probe and fallback path) */}
            <div className="hero-visual lg:col-span-5 reveal stagger-0">
              <div className="hero-visual-frame rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900/95 to-slate-800 dark:from-slate-950 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700/80">
                <HeroShowcase />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Steps Section - BookMyStudio style */}
      <section className="py-14 sm:py-16 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center reveal stagger-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">HOW IT WORKS</span>
            <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Book in <span className="text-emerald-600 dark:text-emerald-400">Three Steps</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
              From first search to paid invoice — nothing hidden in between.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.title}
                className="bento-card-interactive p-6 h-full"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 650, delay: index * 100, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                    <step.icon size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
                    STEP <span className="text-emerald-600 dark:text-emerald-400">{step.step}</span>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 reveal">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 text-sm text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <strong className="text-slate-800 dark:text-white">Booking Transparency:</strong>
                <span>Submitting a request initiates facility coordination. Final confirmation and access details issued upon partner schedule approval and COI verification.</span>
              </span>
              <Link to="/terms" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap self-start sm:self-auto">
                Read Booking Terms →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories / Browse Section */}
      <section className="py-14 sm:py-16 bg-white dark:bg-slate-950">
        <div className="container">
          <div className="reveal stagger-0">
            <div className="section-head">
              <h2 id="categories-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Browse by Category
              </h2>
            </div>
            {categories.loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {Array.from({ length: 4 }, (_, i) => (
                  <div className="bento-card p-6" key={i}>
                    <div className="skeleton h-10 w-1/3 rounded-lg mb-3" />
                    <div className="skeleton h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : categories.error ? (
              <ErrorState message={categories.error.message} onRetry={categories.reload} />
            ) : (categories.data ?? []).length === 0 ? (
              <EmptyState title="No categories yet" message="Categories will appear once they are published." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {(categories.data ?? []).map((category) => {
                  const CategoryIcon = TYPE_ICONS[category.type] ?? Warehouse;
                  return (
                    <Link
                      key={category.id}
                      to={`/search?categoryId=${category.id}&type=${category.type}`}
                      className="bento-card-interactive p-5 flex flex-col gap-3 h-full"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                        <CategoryIcon size={20} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{category.name}</h3>
                        {category.description ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{category.description}</p>
                        ) : null}
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-auto pt-1">
                          <span className="font-mono">→</span>
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
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-14 sm:py-16 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="container">
          <div className="reveal stagger-0">
            <div className="section-head flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h2 id="featured-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Featured Listings
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Top-rated spaces and equipment from verified partners</p>
              </div>
              <Link to="/search?sort=rating_desc" className="nav-pill inline-flex items-center gap-1.5">
                View all <ArrowRightIcon size={12} aria-hidden="true" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(featured.data?.items ?? []).map((listing, index) => (
                  <motion.div
                    key={listing.id}
                    className="h-full"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ListingCard listing={listing} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Why BookMyWarehouse - Value Props as Bento Grid */}
      <section className="py-14 sm:py-16 bg-white dark:bg-slate-950">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center reveal stagger-0 mb-10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">WHY BOOKMYWAREHOUSE</span>
            <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Why <span className="text-emerald-600 dark:text-emerald-400">BookMyWarehouse</span>?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VALUE_PROPS.map((prop) => (
              <motion.div
                key={prop.title}
                className="bento-card-interactive p-6 flex flex-col gap-3 h-full"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 650, delay: 100, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  <prop.icon size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{prop.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{prop.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner CTA Section - BookMyStudio Host style */}
      <section className="py-14 sm:py-16 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="container">
          <div className="bg-slate-900 dark:bg-slate-900 rounded-3xl p-6 sm:p-10 lg:p-12 text-white relative overflow-hidden reveal stagger-0">
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-blob" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-blob animation-delay-2000" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-7 space-y-5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-400">PARTNER PROGRAM</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  Have Space, Equipment or a Crew?
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                  List on BookMyWarehouse, pass KYC once, and get booking requests from businesses across India — on your schedule.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link to={PARTNER_APP_URL} className="btn btn-brand btn-lg">
                    List Your Space <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                  <Link to="/partner-benefits" className="btn btn-outline btn-lg border-white/20 text-white hover:bg-white/10">
                    Partner Benefits
                  </Link>
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="bg-slate-800/50 dark:bg-slate-800 rounded-2xl border border-slate-700/80 p-5 sm:p-6 shadow-inner transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-600">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">ESTIMATED MONTHLY EARNINGS</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">₹1,25,000</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <span>✔</span><span>Based on 10 booking days per month</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Average Day Rate</span>
                      <span className="font-bold text-white">₹12,500 / day</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Equipment Add-on</span>
                      <span className="font-bold text-emerald-400">+₹50,000 / month</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Automated Direct Payout</span>
                      <span className="font-bold text-emerald-400">Net 48hrs after wrap</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-slate-900 dark:bg-slate-950 border-t border-slate-800 dark:border-slate-900">
        <div className="container">
          <div className="p-8 sm:p-12 lg:p-16 rounded-3xl bg-slate-900 dark:bg-slate-900 border border-slate-800 dark:border-slate-800 text-white relative overflow-hidden reveal stagger-0">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-blob" />
            <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none animate-blob animation-delay-4000" />

            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 dark:bg-emerald-950/40 text-emerald-400 text-xs font-semibold border border-white/15 dark:border-emerald-500/30">
                <span className="w-3.5 h-3.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
                <span>₹2 Cr Direct Production Liability Coverage Included</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                Ready to Book Your Next Space?
              </h2>
              <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                Join thousands of businesses booking verified warehouses, equipment & logistics services. Lock in live quotes and GST-ready invoices.
              </p>
              <div className="pt-4 flex flex-wrap items-center gap-3">
                <Link to="/search" className="btn btn-brand btn-lg">
                  Explore Listings <ArrowRightIcon size={16} aria-hidden="true" />
                </Link>
                <Link to="/register" className="btn btn-outline btn-lg border-white/20 text-white hover:bg-white/10">
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}