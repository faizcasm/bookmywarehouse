# BOOKMYWAREHOUSE
## Master AI Engineering Prompt: Complete Production-Ready Marketplace

## 1. YOUR ROLE

Act as a principal software architect, senior MERN stack engineer, UI/UX designer, database architect, DevOps engineer, QA engineer, and application security specialist.

Your mission is to design, implement, test, document, and prepare a complete, production-ready BookMyWarehouse platform.

Do not create a static prototype, a frontend-only dashboard, a collection of disconnected pages, or a demo filled with fake functionality. Build a working full-stack product with real database persistence, authentication, authorization, validation, business workflows, and properly connected applications.

Work autonomously wherever requirements are clear. Inspect the existing repository before making changes. Preserve useful existing code, identify gaps, and implement the product systematically.

Do not stop after generating a plan. Continue implementing, running tests, fixing errors, and verifying functionality until the available scope is complete.

---

## 2. PRODUCT OVERVIEW

Product name: BookMyWarehouse

BookMyWarehouse is a B2B marketplace that connects businesses looking for storage, warehousing, industrial facilities, logistics equipment, and related services with verified warehouse owners, equipment providers, and service partners.

Customers must be able to discover suitable facilities, compare available options, submit booking requests, communicate with partners, track booking progress, manage invoices, leave reviews, and access their booking history.

Partners must be able to list and manage their facilities, equipment, and services, respond to booking requests, manage availability, track revenue, and operate their businesses through a dedicated partner dashboard.

Administrators must be able to oversee users, partners, listings, bookings, payments, disputes, reviews, platform configuration, verification, and business analytics.

The platform must support three separate applications:

1. Customer application.
2. Partner application.
3. Admin panel.

All three applications must use the same secure backend and shared data model, with role-based permissions and a consistent design system.

---

## 3. TECHNOLOGY STACK

Use the following stack unless a genuine technical limitation requires a documented alternative.

### Frontend
- React with TypeScript.
- Vite.
- React Router.
- Tailwind CSS.
- shadcn/ui and Radix UI where appropriate.
- Lucide React icons.
- TanStack Query for server-state management.
- React Hook Form and Zod for forms and validation.
- Recharts for analytics.
- A lightweight global state solution only where necessary.
- Responsive layouts for desktop, tablet, and mobile.

Use strict TypeScript settings. Avoid `any`, duplicated components, unnecessary dependencies, and oversized frontend bundles.

### Backend
- Node.js with Express and TypeScript.
- MongoDB Atlas as the primary database.
- Mongoose for schemas, relationships, indexes, and validation.
- Zod for request validation.
- REST APIs under `/api/v1`.
- Centralized error handling.
- Structured logging.
- Swagger/OpenAPI documentation.
- Secure authentication using short-lived access tokens and appropriately managed refresh sessions or secure server-side sessions.
- Role-based and resource-level authorization.

### Infrastructure and services
- Git and GitHub.
- Vercel for frontend hosting and suitable serverless API deployments.
- MongoDB Atlas free tier for development where currently available.
- Cloudinary or an equivalent free-tier image service for listing images and document uploads.
- Resend or another suitable email provider for transactional notifications, subject to free-tier limits.
- An optional external payment gateway, implemented through a provider abstraction.

Verify current platform limits and free-tier eligibility before selecting services. Do not assume every service is permanently free.

### Suggested repository structure

Use a monorepo:

```text
bookmywarehouse/
  apps/
    customer/
    partner/
    admin/
    api/
  packages/
    shared-types/
    validation/
    ui/
    config/
  docs/
  scripts/
  .github/
  package.json
  pnpm-workspace.yaml
  README.md
  .env.example
```

Use pnpm workspaces. Configure Vercel projects with the appropriate root directories and build commands. If deploying the API as serverless functions, structure it accordingly and avoid long-running processes, in-memory state, and unsupported persistent connections.

If a single repository with separate Vercel projects creates unnecessary deployment complexity, document the trade-off and use a simpler maintainable deployment arrangement.

Do not use Docker, paid infrastructure, or additional microservices unless genuinely needed.

---

## 4. APPLICATION ARCHITECTURE

Create three polished, independent user experiences.

### A. Customer application

Suggested routes:

- `/`
- `/search`
- `/warehouses`
- `/warehouses/:slug`
- `/services`
- `/services/:slug`
- `/equipment`
- `/equipment/:slug`
- `/categories`
- `/how-it-works`
- `/about`
- `/contact`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/dashboard`
- `/dashboard/bookings`
- `/dashboard/bookings/:id`
- `/dashboard/favorites`
- `/dashboard/messages`
- `/dashboard/invoices`
- `/dashboard/reviews`
- `/dashboard/profile`
- `/dashboard/notifications`

Build a high-quality landing page with:
- A prominent warehouse search interface.
- Search by city, PIN code, region, or address.
- Warehouse and industrial storage categories.
- Recommended and recently added listings.
- Popular locations.
- Equipment and logistics services.
- A clear booking process.
- Verified partner indicators.
- Trust and safety information.
- Testimonials only when genuine data exists.
- Strong calls to action for customers and partners.
- A professional footer with useful navigation.

Search results must include filters for:
- Location and service radius where supported.
- Facility type.
- Available capacity and unit.
- Monthly, daily, or other supported pricing periods.
- Price range.
- Availability dates.
- Amenities and supported facility features.
- Verification status.
- Minimum ratings where sufficient review data exists.

Provide sorting by relevance, price, capacity, rating, and recency.

Warehouse detail pages must include:
- Image gallery.
- Facility description.
- Location and service area.
- Storage capacity and units.
- Supported storage types.
- Dimensions and facility specifications where applicable.
- Amenities and safety features.
- Pricing model and additional charges.
- Availability.
- Partner information and verification status.
- Reviews and ratings.
- Booking request form.
- Cancellation terms.
- Related facilities.

Support favorites, booking history, invoices, notifications, and customer profile management.

### B. Partner application

Suggested routes:

- `/partner`
- `/partner/register`
- `/partner/login`
- `/partner/onboarding`
- `/partner/dashboard`
- `/partner/listings`
- `/partner/listings/new`
- `/partner/listings/:id/edit`
- `/partner/equipment`
- `/partner/services`
- `/partner/bookings`
- `/partner/bookings/:id`
- `/partner/availability`
- `/partner/calendar`
- `/partner/messages`
- `/partner/earnings`
- `/partner/invoices`
- `/partner/reviews`
- `/partner/verification`
- `/partner/notifications`
- `/partner/settings`

Partner onboarding must collect:
- Owner or business name.
- Contact information.
- Business address.
- Business type.
- Supported facility or service categories.
- Applicable business verification documents.
- Bank or payout details only when needed and through a secure, appropriate workflow.

Implement partner verification states:
- Draft.
- Submitted.
- Under review.
- Verified.
- Rejected.
- Suspended.

Partner dashboard functionality:
- Overview of active listings.
- Pending, confirmed, completed, and cancelled bookings.
- Booking request response rates.
- Revenue and booking trends.
- Upcoming reservations.
- Listing performance.
- Unread messages and notifications.
- Verification status.

Partners must be able to:
- Create, edit, preview, publish, unpublish, and archive listings.
- Upload and reorder images.
- Define prices, capacity, minimum booking duration, and supported services.
- Configure availability and blocked dates.
- Set booking rules and cancellation policies.
- Review booking requests.
- Accept or reject requests with appropriate reasons.
- Track booking statuses.
- Manage equipment and logistics services.
- Respond to customer messages.
- View reviews and submit responses where supported.
- Access revenue reports and booking invoices.

Do not expose sensitive customer data to unrelated partners.

### C. Admin panel

Suggested routes:

- `/admin/login`
- `/admin/dashboard`
- `/admin/users`
- `/admin/partners`
- `/admin/partners/:id`
- `/admin/verification`
- `/admin/listings`
- `/admin/bookings`
- `/admin/payments`
- `/admin/refunds`
- `/admin/invoices`
- `/admin/categories`
- `/admin/services`
- `/admin/equipment`
- `/admin/reviews`
- `/admin/disputes`
- `/admin/reports`
- `/admin/notifications`
- `/admin/audit-logs`
- `/admin/settings`

Admin functionality:
- Platform overview and business KPIs.
- Customer and partner management.
- Partner verification and document review.
- Listing approval, rejection, suspension, and moderation.
- Booking oversight and cancellation management.
- Payment transaction monitoring.
- Refund and dispute workflows.
- Review moderation.
- Category and service management.
- Commission and platform fee configuration.
- Platform settings.
- Support and complaint management.
- Audit trails for privileged actions.
- Exportable reports with appropriate permissions.

Provide secure, searchable, filterable, paginated data tables.

Never expose public admin registration. Bootstrap the first administrator through a secure, documented server-side procedure or controlled deployment command. Do not hardcode administrator credentials.

High-risk admin actions must require confirmation and generate audit records.

---

## 5. MARKETPLACE CATEGORIES

The system must support three primary listing types.

### Warehouses and storage facilities
- General warehousing.
- Industrial storage.
- Commercial storage.
- Distribution centers.
- Cold storage.
- Fulfilment and inventory storage.
- Short-term and long-term storage.
- Other administrator-configurable facility categories.

### Equipment
- Forklifts.
- Cranes.
- Pallet trucks.
- Material-handling equipment.
- Loading equipment.
- Other configurable equipment categories.

Equipment listings should support rental duration, delivery requirements, operating specifications, availability, and optional operator services.

### Logistics and related services
- Loading and unloading.
- Packaging.
- Transportation.
- Material handling.
- Inventory management support.
- Other administrator-configurable services.

Services should support service area, pricing model, estimated duration, availability, and optional booking-specific requirements.

Use reusable listing schemas and category-specific attributes rather than creating a completely separate, duplicated application for every category.

---

## 6. CORE BUSINESS WORKFLOWS

Implement these workflows end to end.

### Customer booking workflow

1. Customer searches for a facility, equipment item, or service.
2. Customer opens a listing and reviews its details.
3. Customer chooses a supported booking duration or service date.
4. Customer enters capacity, quantity, delivery requirements, or other relevant information.
5. Backend validates the request and calculates the price.
6. Customer submits a booking request.
7. Partner receives a notification.
8. Partner accepts or rejects the request.
9. Customer is notified of the decision.
10. Where payment is required, the customer completes the configured payment workflow.
11. Booking status is updated according to the payment and confirmation policy.
12. Customer and partner can track progress.
13. Booking is completed or cancelled under applicable rules.
14. Invoice or receipt is generated where appropriate.
15. Eligible customers can leave reviews after completion.

Define explicit state transitions and prevent invalid transitions.

Suggested booking statuses:

- `DRAFT`
- `PENDING_APPROVAL`
- `AWAITING_PAYMENT`
- `CONFIRMED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `REJECTED`
- `REFUND_PENDING`
- `REFUNDED`
- `DISPUTED`

Do not force every booking through every state. Warehouse reservations, equipment rentals, and service bookings may require slightly different transition rules.

### Partner listing workflow

1. Partner registers.
2. Partner completes business onboarding.
3. Partner submits verification documents.
4. Admin reviews the application.
5. Partner creates a listing.
6. Listing passes validation and any required moderation.
7. Listing becomes discoverable only when all publication conditions are satisfied.
8. Partner manages availability and pricing.
9. Customers submit booking requests.
10. Partner manages accepted bookings and service delivery.

### Booking and availability integrity

Prevent overlapping bookings for the same capacity or resource.

For warehouses that support partial-capacity reservations, calculate available capacity for the requested interval rather than treating the entire warehouse as unavailable.

For equipment, prevent double booking of the same unit or quantity.

For services, validate provider capacity and availability.

Use atomic database operations, appropriate indexes, and transaction support where the deployment environment supports it. Design carefully for MongoDB serverless connections.

A listing must never become available merely because a client-side form says so. The backend is the source of truth.

---

## 7. DATABASE DESIGN

Design normalized, maintainable Mongoose schemas for:

- User.
- CustomerProfile.
- PartnerProfile.
- BusinessVerification.
- Listing.
- WarehouseDetails.
- EquipmentDetails.
- ServiceDetails.
- AvailabilityRule.
- AvailabilityException.
- Booking.
- BookingItem where appropriate.
- Payment.
- Refund.
- Invoice.
- Review.
- Favorite.
- Conversation.
- Message.
- Notification.
- Category.
- Coupon, if implemented.
- Dispute.
- PlatformSettings.
- AuditLog.

Use shared types and schemas where sensible.

Each schema must define:
- Required and optional fields.
- Enums.
- Validation.
- Timestamps.
- Relationships and ownership.
- Indexes.
- Uniqueness constraints where applicable.
- Safe serialization rules.
- Appropriate deletion or archival behavior.

Use ObjectId references where appropriate.

Create indexes for listing discovery, text search where suitable, partner ownership, booking lookup, date ranges, and notification retrieval.

Use geospatial indexes if implementing radius-based location search.

Avoid storing duplicate derived data unless there is a clear consistency strategy.

Never store plaintext passwords, raw payment credentials, unnecessary sensitive identity documents, or unencrypted secrets.

Include seed scripts that create realistic demo listings, categories, bookings, and users without embedding production secrets. Seed data must be explicitly marked as development or demonstration data.

---

## 8. AUTHENTICATION AND AUTHORIZATION

Implement:
- Registration.
- Login and logout.
- Email verification.
- Password reset.
- Secure password hashing with Argon2id or an appropriate secure alternative.
- Refresh-session rotation and revocation, if using token-based authentication.
- Secure cookies where supported by the architecture.
- Role-based access control.
- Resource ownership checks.
- Account suspension.
- Rate limiting.
- Authentication audit events.

Roles:
- `CUSTOMER`
- `PARTNER`
- `ADMIN`
- Optional `SUPER_ADMIN` only if there is a justified need.

Users must not be able to elevate their roles through request bodies or manipulated JWT claims.

Partners may access only their own listings, bookings, messages, and financial records.

Customers may access only their own personal data and bookings.

Admin access must be restricted to explicitly authorized users.

Validate every protected backend endpoint independently of frontend routing.

Use CSRF protection where applicable to cookie-based authentication. Apply safe CORS policies, secure HTTP headers, request-size limits, and input validation.

Do not log passwords, access tokens, payment secrets, or sensitive verification documents.

---

## 9. PAYMENTS, PRICING, AND INVOICES

Implement a pricing engine that supports:
- Fixed-price bookings.
- Per-square-foot or per-square-meter pricing where applicable.
- Per-pallet or per-unit storage pricing.
- Daily and monthly rental.
- Equipment rental periods.
- Service-based pricing.
- Quantity-based charges.
- Configurable platform commission.
- Applicable taxes and additional fees.

Store monetary values as integer minor units wherever possible, with an explicit currency. Avoid floating-point arithmetic for financial calculations.

Use INR as the initial display currency, with support for future configuration.

Create a payment provider abstraction so a real payment gateway can be integrated without rewriting booking logic.

Payment requirements:
- Payment initiation on the server.
- Payment status verification on the server.
- Webhook signature verification.
- Idempotent webhook processing.
- Safe duplicate-event handling.
- Transaction and refund records.
- Reconciliation support.
- Clear payment-failure handling.

Never trust the payment success redirect from a browser as proof of payment.

Do not store card numbers or CVVs.

If live payment credentials are unavailable, implement a clearly labeled sandbox or simulated payment provider for development and testing. Never describe simulated transactions as real payments.

Invoices must contain the appropriate business and customer details, booking reference, line items, taxes when applicable, fees, totals, and payment status.

Generate downloadable invoice PDFs using a suitable library if feasible within the deployment architecture.

Make clear that invoice generation does not automatically satisfy all legal invoicing requirements. Production tax and invoicing rules must be confirmed for the relevant business model.

---

## 10. NOTIFICATIONS AND COMMUNICATION

Implement an in-app notification system for:
- Registration and verification events.
- New booking requests.
- Booking approvals and rejections.
- Payment events.
- Booking reminders.
- Cancellation and refund updates.
- New messages.
- Listing approval and rejection.
- Reviews and disputes.

Notifications should have read/unread states, timestamps, and relevant navigation links.

Use an email provider adapter for transactional email. If credentials are missing, log a safe development event and expose the unconfigured status clearly.

Implement basic customer-partner messaging with conversation ownership checks, pagination, and message timestamps.

Use polling or a suitable lightweight refresh strategy on free hosting. Add real-time sockets only if the deployment architecture supports them reliably and there is a clear business requirement.

Do not make notifications or messaging dependent on an always-running server.

---

## 11. UI/UX AND DESIGN SYSTEM

Design BookMyWarehouse as a premium B2B marketplace. The interface should feel trustworthy, modern, operationally clear, and suitable for real business users.

Visual direction:
- Clean white and light-neutral surfaces.
- Deep navy or charcoal text.
- Professional blue or indigo accents.
- Consistent spacing and typography.
- Subtle borders and shadows.
- Carefully selected status colors.
- Clear hierarchy and readable data tables.
- Professional listing photography.
- Consistent iconography.
- Responsive navigation and layouts.

Avoid:
- Excessive gradients.
- Random colors.
- Unnecessary glassmorphism.
- Overuse of rounded cards.
- Giant hero sections that hide actual functionality.
- Placeholder charts pretending to contain real business data.
- Inconsistent spacing and typography.
- Empty buttons or nonfunctional navigation.
- Browser alerts for ordinary application feedback.

Create a shared design system with reusable:
- Buttons.
- Inputs.
- Selects.
- Date pickers.
- Modals.
- Drawers.
- Dropdowns.
- Tables.
- Status badges.
- Pagination.
- Search and filter components.
- Empty states.
- Skeleton loaders.
- Error states.
- Toast notifications.
- Confirmation dialogs.
- Form validation messages.

Each application should have a distinct navigation structure while sharing the same branding and core component library.

Provide:
- Loading states.
- Empty states.
- Error recovery.
- Responsive layouts.
- Keyboard navigation.
- Visible focus indicators.
- Accessible labels.
- Appropriate contrast.
- Consistent mobile behavior.

Target WCAG 2.2 AA accessibility where practical.

All forms must provide useful validation feedback. All important actions must show a meaningful result.

Use real image assets from a configured image provider or clearly labeled demo assets. Never rely on broken external image URLs.

---

## 12. API DESIGN

Build versioned REST endpoints organized by domain.

Examples:

Authentication:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/auth/me`

Listings:
- `GET /api/v1/listings`
- `GET /api/v1/listings/:id`
- `POST /api/v1/partner/listings`
- `PATCH /api/v1/partner/listings/:id`
- `DELETE /api/v1/partner/listings/:id`
- `POST /api/v1/partner/listings/:id/publish`

Bookings:
- `POST /api/v1/bookings`
- `GET /api/v1/bookings`
- `GET /api/v1/bookings/:id`
- `POST /api/v1/bookings/:id/cancel`
- `POST /api/v1/partner/bookings/:id/accept`
- `POST /api/v1/partner/bookings/:id/reject`
- `POST /api/v1/partner/bookings/:id/complete`

Administration:
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/partners`
- `POST /api/v1/admin/partners/:id/verify`
- `POST /api/v1/admin/partners/:id/reject`
- `GET /api/v1/admin/listings`
- `GET /api/v1/admin/payments`
- `GET /api/v1/admin/audit-logs`

These are examples, not a complete endpoint list. Add all necessary APIs for the implemented features.

Use:
- Consistent JSON response shapes.
- Appropriate HTTP status codes.
- Cursor-based or page-based pagination.
- Search and filter parameters.
- Strict request validation.
- Centralized error responses.
- Request IDs.
- Rate limits for sensitive operations.
- OpenAPI documentation.

Avoid unbounded database queries and returning unnecessary document fields.

---

## 13. SEARCH, SEO, AND PERFORMANCE

Implement useful search and filtering using MongoDB indexes and server-side queries.

For location searches, support normalized location fields and optional geospatial lookup.

Do not load the entire listings collection into the browser to filter it.

Implement:
- Debounced search.
- Pagination.
- Query-state persistence where appropriate.
- Server-side sorting.
- Image optimization.
- Lazy loading.
- Route-level code splitting.
- Appropriate caching.
- Database connection reuse.
- Efficient database projections.
- Compression and production build optimization.

For public pages, add:
- SEO titles and descriptions.
- Canonical URLs where appropriate.
- Open Graph metadata.
- Sitemap generation.
- Robots configuration.
- Structured data only when accurate.
- Shareable listing URLs.

Do not expose private dashboard pages or personal data through search engines.

---

## 14. TESTING AND QUALITY ASSURANCE

Write and run meaningful automated tests.

### Unit tests
Test:
- Price calculations.
- Booking state transitions.
- Availability calculations.
- Validation schemas.
- Commission calculations.
- Permission policies.

### API integration tests
Test:
- Registration and login.
- Authorization failures.
- Listing creation and publication.
- Booking creation.
- Double-booking prevention.
- Partner approval and rejection.
- Payment webhook idempotency.
- Review eligibility.
- Invoice access control.

### Frontend tests
Test:
- Important forms.
- Search and filters.
- Booking interactions.
- Authentication states.
- Dashboard loading and error states.
- Role-based navigation.

### End-to-end tests
Use Playwright or a suitable alternative for core workflows.

At minimum, verify:
1. A customer registers and searches for a warehouse.
2. A customer submits a booking request.
3. A partner receives and accepts the request.
4. The booking status updates correctly.
5. A customer can access the booking details.
6. An administrator verifies a partner.
7. An administrator approves or rejects a listing.
8. Unauthorized users cannot access protected records.
9. Overlapping reservations cannot exceed available capacity.
10. Duplicate payment webhooks do not create duplicate financial records.

Run linting, type checking, tests, and production builds. Fix actual errors rather than suppressing them.

Never claim a test passed unless it was actually executed successfully.

---

## 15. DEPLOYMENT ON VERCEL FREE TIER

Target deployment on Vercel's free tier for an eligible personal or non-commercial development setup, while checking current plan restrictions before deployment.

The platform must be designed around serverless limitations.

Requirements:
- Separate Vercel projects for customer, partner, admin, and API if using the proposed monorepo architecture.
- Correct root directory and build configuration for each project.
- Environment variables configured through the hosting dashboard.
- MongoDB Atlas connection reuse.
- No dependency on local filesystem persistence.
- No assumption that background workers or WebSocket servers will remain alive.
- No secrets committed to Git.
- Correct frontend API base URLs.
- Appropriate CORS and cookie configuration.
- Secure webhook endpoints.
- Health-check endpoint.
- Production logging.
- Deployment instructions.
- Rollback guidance.

Suggested domains, subject to availability and configuration:
- `bookmywarehouse.com`
- `partner.bookmywarehouse.com`
- `admin.bookmywarehouse.com`
- `api.bookmywarehouse.com`

Use the actual domain available to the project. Do not assume the suggested domain has been purchased.

Prefer Vercel's supported Node.js deployment model for the API. If serverless execution constraints become significant, document the simplest suitable alternative rather than forcing unsupported infrastructure into the design.

Free tiers may impose usage limits, cold starts, storage limits, and commercial-use restrictions. Clearly identify any requirement that cannot be met reliably on the chosen free tier.

---

## 16. ENVIRONMENT CONFIGURATION

Create a complete `.env.example` containing placeholders such as:

```dotenv
NODE_ENV=
PORT=
API_BASE_URL=
CUSTOMER_APP_URL=
PARTNER_APP_URL=
ADMIN_APP_URL=

MONGODB_URI=

ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
SESSION_SECRET=

EMAIL_PROVIDER_API_KEY=
EMAIL_FROM=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

PAYMENT_PROVIDER=
PAYMENT_PUBLIC_KEY=
PAYMENT_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=

LOG_LEVEL=
```

Include only variables actually required by the implemented architecture. Never place real credentials in the repository.

Validate required environment variables at startup. In production, fail fast when essential secrets or configuration are missing. In development, provide clear actionable setup errors.

---

## 17. BUSINESS RULES AND DATA INTEGRITY

Enforce these rules on the backend:

- Unverified partners cannot publish listings requiring verification.
- Suspended accounts cannot perform prohibited operations.
- Customers cannot modify partner listings.
- Partners cannot access other partners' private records.
- Booking totals must be calculated server-side.
- Capacity and availability must be validated against existing reservations.
- A rejected or cancelled booking cannot be accepted through an invalid transition.
- Payment success must be verified independently of client navigation.
- Refunds must be tied to valid transactions and applicable policies.
- Only eligible customers can review completed bookings.
- Reviews cannot be submitted repeatedly for the same eligible booking unless a documented policy allows it.
- Admin decisions must be recorded in an audit log.
- Sensitive documents must not be publicly accessible.
- Pagination, filtering, and sorting must be validated.
- Deletion of financially relevant records must follow a safe archival policy.
- Every public listing must satisfy publication requirements.
- All monetary calculations must use a consistent currency and rounding policy.

Write these rules as reusable domain services rather than scattering them throughout controllers.

---

## 18. IMPLEMENTATION STRATEGY

Follow this sequence.

### Phase 1: Repository inspection and architecture
- Inspect all existing files.
- Identify the current stack and available assets.
- Check package versions and deployment constraints.
- Document architectural decisions.
- Create the monorepo structure if necessary.
- Set up shared TypeScript configuration and tooling.

### Phase 2: Backend foundation
- Connect MongoDB.
- Implement schemas and indexes.
- Build authentication and authorization.
- Add validation and error handling.
- Set up API documentation and testing.

### Phase 3: Customer marketplace
- Build the landing page.
- Implement search and listing details.
- Implement customer accounts and dashboards.
- Add favorites and booking requests.

### Phase 4: Partner operations
- Build onboarding and verification.
- Implement listing management.
- Add availability and booking workflows.
- Build messaging, notifications, and financial summaries.

### Phase 5: Administration
- Build protected admin access.
- Implement verification queues.
- Add listing moderation.
- Add user, booking, payment, and dispute management.
- Add audit logs and analytics.

### Phase 6: Payments and supporting services
- Implement the pricing engine.
- Add the payment abstraction and sandbox.
- Implement invoice generation.
- Add email and in-app notifications.
- Add reviews and moderation.

### Phase 7: Quality and production readiness
- Run automated tests.
- Verify authorization boundaries.
- Fix TypeScript and build errors.
- Audit dependency and security issues.
- Optimize queries and frontend bundles.
- Test responsive behavior.
- Document operational limitations.

### Phase 8: Deployment
- Configure Vercel projects.
- Configure MongoDB Atlas.
- Set environment variables.
- Configure domains and CORS.
- Deploy applications.
- Verify API health and core workflows.
- Document the final deployment state.

At the end of each phase, update `docs/PROGRESS.md` with completed work, outstanding issues, test results, and the next tasks.

---

## 19. ENGINEERING RULES

These rules are mandatory.

1. Implement working functionality, not visual placeholders.
2. Do not leave important buttons, navigation items, or forms nonfunctional.
3. Do not use hardcoded dashboard statistics as if they were live data.
4. Use seed data only for explicitly identified development and demonstration scenarios.
5. Do not put database queries, complex business logic, and authorization checks directly into React components.
6. Keep controllers thin and domain services testable.
7. Do not duplicate the same business logic across applications.
8. Never bypass TypeScript errors using blanket `any`, `@ts-ignore`, or disabled compiler checks.
9. Never disable security protections just to make deployment easier.
10. Never expose environment secrets in frontend bundles.
11. Never claim deployment, integration, or testing succeeded without verification.
12. Avoid overengineering, unnecessary abstractions, microservices, and paid dependencies.
13. Use reusable components and consistent naming conventions.
14. Handle loading, error, empty, and success states.
15. Keep documentation aligned with actual implementation.
16. If an external API credential is unavailable, implement a documented adapter or sandbox and identify the missing integration clearly.
17. When blocked, investigate the cause, attempt a reasonable fix, and document any genuine external dependency.
18. Make small, verifiable changes and run the relevant tests frequently.
19. Do not destroy existing work during repository restructuring.
20. Prioritize correctness, security, usability, and maintainability over adding superficial features.

---

## 20. DEFINITION OF DONE

The project is complete only when:

- All three applications run.
- The backend starts and connects to the configured database.
- Authentication and authorization work.
- Customer search returns database-backed results.
- Partners can create and manage listings.
- Admins can verify partners and moderate listings.
- Booking requests can be submitted, accepted, rejected, cancelled, and completed according to valid rules.
- Availability checks prevent conflicting reservations.
- Pricing is calculated on the server.
- Payment handling is implemented through a clearly identified real or sandbox provider.
- Notifications and reviews work within the implemented scope.
- Invoices can be generated or accessed as documented.
- Dashboards display real backend data.
- Protected routes and APIs enforce permissions.
- Core automated tests pass.
- Type checking, linting, and production builds pass.
- Responsive layouts work on mobile and desktop.
- Environment variables and deployment instructions are documented.
- No critical workflow depends on a nonfunctional placeholder.

---

## 21. FINAL EXECUTION INSTRUCTIONS

Start by inspecting the repository and creating a concise implementation plan. Then immediately begin implementation.

Do not return only a proposed architecture, a list of files, or a design description.

Work through the project in verifiable stages. Use the terminal to install dependencies, generate files, run the development server, execute tests, and fix failures whenever those capabilities are available.

Prioritize a complete vertical slice of the core marketplace first: customer search, listing details, booking request, partner approval, and admin verification. Then expand to the remaining modules.

If context or execution limits interrupt the work, save the current state in `docs/PROGRESS.md`, including the exact completed work, commands executed, errors remaining, and next steps, so development can resume without repeating completed work.

At completion, provide:
- Implemented features.
- Final repository structure.
- Setup and run commands.
- Required environment variables.
- Database setup and seed instructions.
- Test results.
- Deployment instructions and deployed URLs, only if actually deployed.
- Missing credentials or external integrations.
- Known limitations and remaining production risks.

Build BookMyWarehouse as a coherent, secure, maintainable marketplace that can be extended into a real business. Start inspecting the repository now and proceed with implementation.
