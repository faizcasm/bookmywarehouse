/**
 * Partner reviews — every published review on the partner's listings, with an
 * inline response flow (POST /reviews/:id/respond).
 *
 * The server scopes GET /me/reviews to the acting role, so for partners it
 * already returns "reviews of my listings" rather than reviews I wrote.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Banner,
  Button,
  Card,
  Screen,
  SectionHeader,
  Sheet,
  SignInPrompt,
  StarRating,
  TextField,
} from '@/components/ui';
import { listMyReviews, respondToReview } from '@/services/api/account';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatDateTime, formatRelativeTime } from '@/utils/format';
import type { Review } from '@/types';

const MIN_RESPONSE = 5;
const MAX_RESPONSE = 2000;

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Try again.';

export default function PartnerReviewsScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();

  const [responding, setResponding] = useState<Review | null>(null);
  const [text, setText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const respond = useMutation({
    mutationFn: (vars: { id: string; text: string }) => respondToReview(vars.id, vars.text),
    onSuccess: () => {
      setResponding(null);
      setText('');
      setFormError(null);
      setNotice('Response published — the customer has been notified.');
      qc.invalidateQueries({ queryKey: ['partner-reviews'] });
      qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
    },
    onError: (e) => setFormError(errorText(e)),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to see reviews"
          subtitle="Reviews on your listings, and your responses to them, live in your partner account."
          next="/(partner)/reviews"
        />
      </Screen>
    );
  }

  const closeSheet = () => {
    if (respond.isPending) return;
    setResponding(null);
    setFormError(null);
  };

  const submitResponse = () => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_RESPONSE) {
      setFormError(`A response needs at least ${MIN_RESPONSE} characters.`);
      return;
    }
    if (trimmed.length > MAX_RESPONSE) {
      setFormError(`Keep the response under ${MAX_RESPONSE} characters.`);
      return;
    }
    if (!responding) return;
    respond.mutate({ id: responding.id, text: trimmed });
  };

  return (
    <Screen style={styles.screen}>
      <SectionHeader title="Reviews" />
      {notice ? (
        <Banner tone="success" message={notice} actionLabel="Dismiss" onAction={() => setNotice(null)} />
      ) : null}

      <PaginatedList<Review>
        queryKey={['partner-reviews']}
        fetchPage={(page) => listMyReviews({ page, limit: 10 })}
        keyExtractor={(review) => review.id}
        itemHeight={200}
        emptyTitle="No reviews yet"
        emptySubtitle="Customer reviews appear here once a booking is completed."
        renderItem={(review) => (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <StarRating rating={review.rating} size={15} />
              <Text style={[styles.author, { color: t.fgStrong }]} numberOfLines={1}>
                {review.authorName ?? 'Customer'}
              </Text>
              <Text style={{ color: t.faint, fontSize: 12 }}>
                {formatRelativeTime(review.createdAt)}
              </Text>
            </View>
            {review.listingTitle ? (
              <Text style={{ color: t.muted, fontSize: 12.5 }} numberOfLines={1}>
                {review.listingTitle}
              </Text>
            ) : null}
            {review.comment ? (
              <Text style={[styles.comment, { color: t.fg }]}>{review.comment}</Text>
            ) : (
              <Text style={{ color: t.faint, fontSize: 13, fontStyle: 'italic' }}>
                No written feedback — rating only.
              </Text>
            )}

            {review.response ? (
              <View style={[styles.response, { backgroundColor: t.surface2, borderColor: t.line }]}>
                <View style={styles.responseHeader}>
                  <Text style={[styles.responseLabel, { color: t.muted }]}>Your response</Text>
                  {review.responseAt ? (
                    <Text style={{ color: t.faint, fontSize: 11.5 }}>
                      {formatDateTime(review.responseAt)}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: t.fg, fontSize: 13.5, lineHeight: 19 }}>{review.response}</Text>
                <Button
                  label="Update response"
                  variant="ghost"
                  onPress={() => {
                    setNotice(null);
                    setFormError(null);
                    setText(review.response ?? '');
                    setResponding(review);
                  }}
                />
              </View>
            ) : (
              <Button
                label="Respond"
                variant="secondary"
                onPress={() => {
                  setNotice(null);
                  setFormError(null);
                  setText('');
                  setResponding(review);
                }}
              />
            )}
          </Card>
        )}
      />

      <Sheet
        visible={responding !== null}
        onClose={closeSheet}
        title={responding?.response ? 'Update response' : 'Respond to review'}
        subtitle={
          responding
            ? `${responding.authorName ?? 'Customer'}${responding.listingTitle ? ` · ${responding.listingTitle}` : ''}`
            : undefined
        }
        dismissOnBackdrop={!respond.isPending}
        footer={
          <Button
            label={respond.isPending ? 'Publishing…' : 'Publish response'}
            fullWidth
            loading={respond.isPending}
            disabled={text.trim().length < MIN_RESPONSE}
            onPress={submitResponse}
          />
        }
      >
        <View style={styles.sheetRating}>
          <Star size={14} color={t.warning} fill={t.warning} />
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {responding ? `${responding.rating} out of 5` : ''}
          </Text>
        </View>
        {responding?.comment ? (
          <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 19 }}>{responding.comment}</Text>
        ) : null}
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <TextField
          label="Your response"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setFormError(null);
          }}
          multiline
          placeholder="Thank you for the kind words — see you on the next booking!"
          hint={`${MIN_RESPONSE}–${MAX_RESPONSE} characters. The customer is notified when you publish.`}
          accessibilityLabel="Your response to this review"
          maxLength={MAX_RESPONSE}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  card: { gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  author: { flex: 1, fontSize: 14, fontWeight: '700' },
  comment: { fontSize: 14, lineHeight: 20 },
  response: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginTop: 2,
  },
  responseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  responseLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  sheetRating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
