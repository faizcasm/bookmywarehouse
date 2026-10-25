import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Receipt, ShieldCheck, Warehouse, Zap } from 'lucide-react';

/**
 * Split-screen auth layout: a always-dark brand panel (aurora gradients,
 * orbiting "logistics" motif, value props) beside the focused form panel.
 * The brand panel is decorative — every actionable element lives in the
 * form panel (children), so screen-reader users lose nothing.
 */

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'KYC-verified partners',
    body: 'Listings go live only after document checks.',
  },
  {
    icon: Zap,
    title: 'Live quotes up-front',
    body: 'Subtotal, platform fee and taxes — before you book.',
  },
  {
    icon: Receipt,
    title: 'GST-ready invoices',
    body: 'Every payment generates a downloadable invoice.',
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
            <img className="brand-mark" src="/icons/icon-192.png" alt="" />
            <span className="brand-text">
              BookMy<span className="brand-accent">Warehouse</span>
            </span>
          </div>
          <p className="auth-brand-title">
            India&apos;s marketplace for warehouse space, equipment &amp; logistics services.
          </p>
          <motion.ul
            className="auth-brand-features"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { delayChildren: 0.25, staggerChildren: 0.09 } } }}
          >
            {FEATURES.map((feature) => (
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
