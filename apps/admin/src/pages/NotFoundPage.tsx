import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { fadeUp } from '@bmw/ui';
import { PageHeader } from '../components/States';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" subtitle="The page you're looking for doesn't exist or has been moved." />
      <motion.div className="card" variants={fadeUp} initial="hidden" animate="show" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div className="empty-state__icon" style={{ margin: '0 auto 16px', width: 64, height: 64 }} aria-hidden="true">
            <Search strokeWidth={1.5} size={28} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-strong)', marginBottom: 8 }}>404 — Not Found</h2>
          <p className="muted" style={{ marginBottom: 24 }}>Sorry, we couldn't find that page. It may have been moved or doesn't exist.</p>
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
    </>
  );
}