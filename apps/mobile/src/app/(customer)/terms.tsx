/** Terms of service — plain readable legal copy. */

import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: '1. Acceptance of terms',
    body: 'By creating an account or booking space through BookMyWarehouse, you agree to these terms. If you are using the platform on behalf of a business, you confirm you are authorised to bind that business.',
  },
  {
    heading: '2. The marketplace',
    body: 'BookMyWarehouse is a marketplace connecting customers who need warehouse, equipment or logistics space with partners who list it. We are not a party to the rental agreement between you and a partner.',
  },
  {
    heading: '3. Bookings and payments',
    body: 'Bookings are requests until confirmed by a partner. Prices, taxes and fees are shown before you confirm. Payments are processed by our payment provider; we never store full card details.',
  },
  {
    heading: '4. Cancellations and refunds',
    body: 'Cancellation and refund eligibility depends on the partner policy and the timing of your cancellation. Any refund is returned to the original payment method.',
  },
  {
    heading: '5. Partner obligations',
    body: 'Partners must list accurate, lawful space, honour confirmed bookings, and maintain any licences required to operate. Listings are subject to moderation.',
  },
  {
    heading: '6. Acceptable use',
    body: 'You agree not to misuse the platform, misrepresent listings, or attempt to circumvent fees. We may suspend accounts that violate these terms.',
  },
  {
    heading: '7. Liability',
    body: 'To the maximum extent permitted by law, BookMyWarehouse is not liable for indirect or consequential losses arising from bookings made through the platform.',
  },
  {
    heading: '8. Changes',
    body: 'We may update these terms from time to time. Material changes will be notified in-app before they take effect.',
  },
];

export default function TermsScreen() {
  const t = useTheme();
  return (
    <Screen scroll>
      <Text style={[styles.title, { color: t.fgStrong }]}>Terms of Service</Text>
      {SECTIONS.map((s) => (
        <React.Fragment key={s.heading}>
          <Text style={[styles.heading, { color: t.fgStrong }]}>{s.heading}</Text>
          <Text style={[styles.body, { color: t.muted }]}>{s.body}</Text>
        </React.Fragment>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  heading: { fontSize: 17, fontWeight: '700', marginTop: 12 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 4 },
});
