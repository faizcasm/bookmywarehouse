import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, ArrowUpRight, ShieldCheck, Wallet, Calendar, Headset } from 'lucide-react';
import { PARTNER_APP_URL } from '../auth/AuthContext';
import { useDocumentMeta } from '../lib/useDocumentMeta';

const BENEFITS = [
  {
    icon: Wallet,
    title: 'Transparent payouts',
    body: 'See your earnings, platform fees and payout schedule in one dashboard. Direct payouts after each completed booking.',
  },
  {
    icon: ShieldCheck,
    title: 'KYC-backed trust',
    body: 'Complete verification once and showcase a verified badge that helps businesses book with confidence.',
  },
  {
    icon: Calendar,
    title: 'You control availability',
    body: 'Set working hours, block dates and manage booking requests. Nothing is confirmed without your approval.',
  },
  {
    icon: Headset,
    title: 'Dispute support',
    body: 'If a booking goes wrong, our mediation team reviews the case with both parties and helps reach a fair resolution.',
  },
];

const STEPS = [
  { step: '01', title: 'Create your partner account', body: 'Register and add your business details.' },
  { step: '02', title: 'Complete KYC verification', body: 'Submit documents once — our team reviews them quickly.' },
  { step: '03', title: 'Publish your listings', body: 'Add spaces, equipment or services with specs, photos and pricing.' },
  { step: '04', title: 'Accept bookings & get paid', body: 'Approve requests that fit your schedule and receive payouts.' },
];

export function PartnerBenefitsPage() {
  useDocumentMeta({
    title: 'Partner Benefits — BookMyWarehouse',
    description: 'List your warehouse, equipment or logistics services on BookMyWarehouse and reach businesses across India.',
  });

  return (
    <div className="home-page">
      <section className="hero-section relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-blob" />
        <div className="container relative pt-14 sm:pt-20 pb-14 sm:pb-16">
          <motion.div
            className="max-w-3xl reveal stagger-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="hero-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              Partner Program
            </p>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Turn your idle space, equipment or crew into{' '}
              <span className="text-emerald-600 dark:text-emerald-400">monthly income</span>
            </h1>
            <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              Reach businesses across India looking for verified warehouses, material-handling equipment and logistics
              services — on your schedule, with transparent payouts.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to={PARTNER_APP_URL} className="btn btn-brand btn-lg">
                Become a partner <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="btn btn-outline btn-lg">
                How it works
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-14 sm:py-16 bg-white dark:bg-slate-950 border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center reveal stagger-0 mb-10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">WHY PARTNER WITH US</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Built for <span className="text-emerald-600 dark:text-emerald-400">partners</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BENEFITS.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                className="bento-card-interactive p-6 space-y-3"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  <benefit.icon size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{benefit.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{benefit.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-14 sm:py-16 bg-slate-50 dark:bg-slate-900/50">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center reveal stagger-0 mb-10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">GET STARTED</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Start in <span className="text-emerald-600 dark:text-emerald-400">four steps</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.step}
                className="bento-card p-6 space-y-3"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                    <Check size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
                    STEP <span className="text-emerald-600 dark:text-emerald-400">{step.step}</span>
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to={PARTNER_APP_URL} className="btn btn-brand btn-lg">
              Create a partner account <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
