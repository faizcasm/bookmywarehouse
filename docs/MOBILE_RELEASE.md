# Mobile app testing and release

This guide covers the Expo app in `apps/mobile`. The same install contains customer, partner, and admin experiences; permissions still come from the API, not from hiding tabs.

## Local development with Expo Go

1. Install the monorepo dependencies from the repository root:
   ```bash
   pnpm install
   ```
2. Start the API with a valid root `.env` and reachable MongoDB database:
   ```bash
   pnpm --filter @bmw/api dev
   ```
3. Find the development machine's LAN IPv4 address. On Linux:
   ```bash
   ip -4 addr
   ```
4. From the repository root, set the API URL to that machine's LAN address and start Metro:
   ```bash
   cd apps/mobile
   EXPO_PUBLIC_API_URL=http://192.168.1.46:4000 npx expo start --lan --clear
   ```
   Replace `192.168.1.46` with your own LAN address. The phone and computer must be on the same Wi-Fi, and the computer firewall must allow the API port `4000` and Metro port `8081`.
5. Scan the QR code with a compatible Expo Go app. If Expo Go reports an SDK mismatch, use a development build instead; do not try to fix an SDK mismatch by clearing Metro's cache repeatedly.

Android emulator note: `http://10.0.2.2:4000` is the emulator's route to the host machine. It is not the correct address for a physical phone.

## Required mobile checks

Run from the repository root:

```bash
pnpm --filter @bmw/mobile typecheck
pnpm --filter @bmw/mobile lint
pnpm --filter @bmw/mobile test -- --runInBand
pnpm --filter @bmw/mobile build
```

The GitHub Actions workflow `.github/workflows/mobile-quality.yml` runs the typecheck, lint, tests, and Android/iOS Expo export for mobile-related changes.

## EAS builds

From `apps/mobile`:

```bash
npx eas-cli build:configure
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile production --platform android
npx eas-cli build --profile production --platform ios
```

The `preview` and `production` profiles use `https://api.bookmywarehouse.com`. Confirm that this API host is deployed, has valid TLS, and is configured for the app's production database before distributing builds. iOS store distribution also requires the appropriate Apple developer account and signing setup.

The existing `development` EAS profile points to `10.0.2.2`, so it is intended for an Android emulator. For a physical device, configure a reachable LAN or staging API URL in the build environment.

## Before calling this production

- Replace the sandbox payment flow with a real payment provider and verify server-side payment webhooks, idempotency, refund handling, and reconciliation. A client-side simulated success is not proof of payment.
- Confirm production API availability, TLS, CORS/origin policy where applicable, rate limits, secrets, monitoring, backups, and rollback procedures.
- Test customer, partner, and admin accounts against staging, including rejected/expired sessions, denied role access, booking state transitions, failed uploads, offline/timeout states, and payment failure paths.
- Test on physical Android and iOS devices, not only the Expo web bundle or simulator. Verify image picker permissions, file sharing, invoices/printing, deep links, and app resume behavior.
- Never put private API keys or payment secrets in `EXPO_PUBLIC_*` variables. Expo inlines these values into the client bundle.
- Use real credentials and personal data only in approved staging/production environments. The seeded demo accounts and sandbox checkout are for development only.
