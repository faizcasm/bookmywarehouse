/** Reviews — reviews the customer has written. */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listMyReviews } from '@/services/api/account';
import { formatDate } from '@/utils/format';
import type { Review } from '@/types';

export default function ReviewsScreen() {
  const t = useTheme();

  return (
    <Screen padTop={false} style={styles.screen}>
      <PaginatedList<Review>
        queryKey={['reviews']}
        fetchPage={(page) => listMyReviews({ page })}
        keyExtractor={(r) => r.id}
        emptyTitle="No reviews yet"
        emptySubtitle="Reviews you write after a booking will appear here."
        itemHeight={110}
        renderItem={(review) => (
          <Card>
            <View style={styles.top}>
              <Text style={[styles.rating, { color: t.warning }]}>
                {'★'.repeat(Math.round(review.rating))}
                <Text style={{ color: t.faint }}>{'★'.repeat(5 - Math.round(review.rating))}</Text>
              </Text>
              <Text style={{ color: t.faint, fontSize: 12 }}>{formatDate(review.createdAt)}</Text>
            </View>
            {review.comment ? <Text style={{ color: t.fg, marginTop: 4 }}>{review.comment}</Text> : null}
            {review.response ? (
              <View style={[styles.response, { backgroundColor: t.surface3 }]}>
                <Text style={{ color: t.muted, fontSize: 13 }}>Partner reply: {review.response}</Text>
              </View>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rating: { fontSize: 16, letterSpacing: 1 },
  response: { marginTop: 8, padding: 10, borderRadius: 10 },
});
