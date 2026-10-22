import { motion } from 'motion/react';
import { useDocumentMeta } from '../lib/useDocumentMeta';

const SECTIONS = [
  {
    title: '1. About BookMyWarehouse',
    body: 'BookMyWarehouse is a marketplace that connects businesses needing warehouse space, material-handling equipment and logistics services with verified third-party partners. BookMyWarehouse is not the operator of any listed space or service — every booking is a direct agreement between the customer and the partner.',
  },
  {
    title: '2. Accounts & verification',
    body: 'You must provide accurate information when registering. Partners undergo a KYC and document verification process before their listings go live. You are responsible for keeping your login credentials secure and for all activity under your account.',
  },
  {
    title: '3. Bookings & confirmation',
    body: 'Submitting a booking request initiates facility coordination. A booking is only confirmed once the partner approves the request and any required insurance (COI) verification is complete. Access details and load-in instructions are issued after confirmation.',
  },
  {
    title: '4. Pricing, fees & invoices',
    body: 'Listings display live quotes including subtotal, platform fee and applicable taxes before you book. A platform fee applies to each completed booking. GST-ready invoices are generated for every successful payment and are available from your invoices page.',
  },
  {
    title: '5. Payments',
    body: 'Payments are processed through a secure third-party payment gateway. Card and payment credentials are never stored on BookMyWarehouse servers. Booking amounts are held and released to the partner according to the payout schedule after the service period.',
  },
  {
    title: '6. Cancellations & refunds',
    body: 'Cancellation terms depend on the notice period shown on each listing. Refund eligibility is calculated at the time of cancellation and reflected in your invoice. Refunds are returned to the original payment method within the stated processing window.',
  },
  {
    title: '7. Partner responsibilities',
    body: 'Partners must keep listings accurate, maintain valid certifications and insurance, honour confirmed bookings, and respond to requests within a reasonable time. Repeated no-shows or misleading listings may result in suspension.',
  },
  {
    title: '8. Disputes',
    body: 'If something goes wrong with a booking, you can raise a dispute from the booking detail page. Our team reviews the case with both parties and may mediate a resolution, including refunds where appropriate.',
  },
  {
    title: '9. Acceptable use',
    body: 'You agree not to misuse the platform, bypass verification, transact off-platform to avoid fees, or post content that is unlawful or infringes the rights of others. Violations may lead to account termination.',
  },
  {
    title: '10. Limitation of liability',
    body: 'To the maximum extent permitted by law, BookMyWarehouse is not liable for indirect or consequential losses arising from bookings made through the platform. Our total liability is limited to the platform fees paid to us for the affected booking.',
  },
  {
    title: '11. Changes to these terms',
    body: 'We may update these terms from time to time. Material changes will be communicated through the platform or by email. Continued use of BookMyWarehouse after changes take effect constitutes acceptance of the revised terms.',
  },
  {
    title: '12. Contact',
    body: 'Questions about these terms can be sent to support@bookmywarehouse.dev.',
  },
];

export function TermsPage() {
  useDocumentMeta({
    title: 'Terms of Service — BookMyWarehouse',
    description: 'The terms and conditions governing use of the BookMyWarehouse marketplace.',
  });

  return (
    <div className="container page">
      <motion.div
        className="page-head"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1>Terms of Service</h1>
        <p className="muted">Last updated: October 2026. Please read these terms carefully before using BookMyWarehouse.</p>
      </motion.div>

      <motion.div
        className="card section-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        style={{ padding: '1.75rem 2rem', display: 'grid', gap: '1.5rem' }}
      >
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: '0.4rem' }}>{section.title}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {section.body}
            </p>
          </section>
        ))}
      </motion.div>
    </div>
  );
}
