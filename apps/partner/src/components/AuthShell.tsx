import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { ShieldCheck, Warehouse, Zap, ExternalLink } from 'lucide-react';

/**
 * Split-screen auth layout for the partner console:
 * - Always-dark brand panel with animated aurora + orbiting logistics motif
 * - Glass form panel with backdrop blur
 * The brand panel is decorative (aria-hidden) — all actions live in the form panel.
 */

const PARTNER_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Verified marketplace',
    body: 'KYC-checked partners — listings go live after approval.',
  },
  {
    icon: Zap,
    title: 'Instant booking flow',
    body: 'Customers book, you approve — payments held in escrow.',
  },
  {
    icon: ExternalLink,
    title: 'Multi-type listings',
    body: 'Warehouses, equipment & services — one dashboard.',
  },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand-grid" />
        <div className="auth-brand-aurora auth-brand-aurora--blue" />
        <div className="auth-brand-aurora auth-brand-aurora--teal" />

        <div className="auth-orbit">
          <span className="orbit-ring orbit-ring--outer" />
          <span className="orbit-ring orbit-ring--inner" />
          <span className="orbit-track orbit-track--1">
            <i className="orbit-node orbit-node--blue" />
          </span>
          <span className="orbit-track orbit-track--2">
            <i className="orbit-node orbit-node--teal" />
          </span>
          <span className="orbit-track orbit-track--3">
            <i className="orbit-node orbit-node--amber" />
          </span>
          <span className="orbit-core">
            <Warehouse size={34} />
          </span>
        </div>

        <div className="auth-brand-copy">
          <div className="brand brand-footer auth-brand-mark">
            <span className="brand-mark">BMW</span>
            <span className="brand-text">
              BookMy<span className="brand-accent">Warehouse</span>
            </span>
          </div>
          <p className="auth-brand-title">
            India&apos;s marketplace for warehouse space, equipment & logistics services.
          </p>
          <motion.ul
            className="auth-brand-features"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { delayChildren: 0.25, staggerChildren: 0.09 } } }}
          >
            {PARTNER_FEATURES.map((feature) => (
              <motion.li
                key={feature.title}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
                }}
              >
                <span className="auth-brand-feature-icon">
                  <feature.icon size={16} />
                </span>
                <span>
                  <strong>{feature.title}</strong>
                  <small>{feature.body}</small>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </aside>

      <div className="auth-panel">
        <div className="auth-panel-inner">{children}</div>
      </div>
    </div>
  );
}