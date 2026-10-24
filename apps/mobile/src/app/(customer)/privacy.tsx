/** Privacy policy — plain readable legal copy. */

import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';

const SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: '1. What we collect',
    body: 'We collect the information you provide when you create an account (name, email, phone), the details of bookings you make, and messages you send through the platform.',
  },
  {
    heading: '2. How we use it',
    body: 'We use your data to operate the marketplace: to authenticate you, process bookings and payments, connect you with the other party, and send you transactional notifications.',
  },
  {
    heading: '3. Payment data',
    body: 'Payments are handled by our payment provider. We receive confirmation of payments and refunds but never your full card number or CVV.',
  },
  {
    heading: '4. Sharing',
    body: 'We share your details with the counterparty to a booking as needed to fulfil it (for example, a partner sees your name and contact details for a confirmed booking). We do not sell your data.',
  },
  {
    heading: '5. Security',
    body: 'Session tokens are stored in your device secure storage and transmitted over encrypted connections. Access is limited to what is needed to run the service.',
  },
  {
    heading: '6. Retention',
    body: 'We keep account data while your account is active and for as long as needed to meet legal and accounting obligations.',
  },
  {
    heading: '7. Your rights',
    body: 'You can access and update most of your details from your profile. To request deletion of your account and associated personal data, contact support.',
  },
  {
    heading: '8. Contact',
    body: 'Questions about this policy can be raised through the in-app support channel.',
  },
];

export default function PrivacyScreen() {
  const t = useTheme();
  return (
    <Screen scroll>
      <Text style={[styles.title, { color: t.fgStrong }]}>Privacy Policy</Text>
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
