import { Link } from 'react-router-dom';
import { PARTNER_APP_URL } from '../auth/AuthContext';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="brand brand-footer">
            <span className="brand-mark" aria-hidden="true">
              BMW
            </span>
            <span className="brand-text">
              BookMy<span className="brand-accent">Warehouse</span>
            </span>
          </div>
          <p className="footer-blurb">
            India&apos;s marketplace for warehouse space, material-handling equipment and logistics
            services — with live quotes and verified partners.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="footer-links">
          <h4>Marketplace</h4>
          <Link to="/search?type=WAREHOUSE">Warehouses</Link>
          <Link to="/search?type=EQUIPMENT">Equipment</Link>
          <Link to="/search?type=SERVICE">Services</Link>
        </nav>
        <nav aria-label="Account links" className="footer-links">
          <h4>Account</h4>
          <Link to="/bookings">My bookings</Link>
          <Link to="/invoices">Invoices</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/partner-benefits">Partner benefits</Link>
          <a href={PARTNER_APP_URL}>Partner portal</a>
        </nav>
        <div className="footer-links">
          <h4>Support</h4>
          <Link to="/disputes">Raise a dispute</Link>
          <Link to="/messages">Messages</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} BookMyWarehouse. All rights reserved.</span>
        <Link to="/terms">Terms of Service</Link>
      </div>
    </footer>
  );
}
