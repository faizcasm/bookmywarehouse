import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { fadeUp } from '@bmw/ui';

export function NotFoundPage() {
  return (
    <div className="page">
      <motion.div className="page__intro" variants={fadeUp} initial="hidden" animate="show">
        <h2>Page not found</h2>
        <p className="muted">The page you're looking for doesn't exist or has been moved.</p>
      </motion.div>

      <motion.div
        className="card"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}
      >
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div className="empty-state__icon" style={{ margin: '0 auto 16px', width: 64, height: 64 }} aria-hidden="true">
            <Search strokeWidth={1.5} size={28} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-strong)', marginBottom: 8 }}>404 — Not Found</h2>
          <p className="muted" style={{ marginBottom: 24 }}>
            Sorry, we couldn't find that page. It may have been moved or doesn't exist.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn--primary">
              <Home aria-hidden="true" size={16} />
              Back to Dashboard
            </Link>
            <button type="button" className="btn btn--ghost" onClick={() => window.history.back()}>
              <Search aria-hidden="true" size={16} />
              Go back
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
