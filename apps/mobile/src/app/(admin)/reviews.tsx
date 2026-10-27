/** Admin reviews — list + delete abusive reviews. */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminReviews, moderateReview } from '@/services/api/admin';
import { formatDate } from '@/utils/format';
import type { Review } from '@/types';

export default function AdminReviewsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: string) => moderateReview(id, 'REMOVED'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
    onError: (e) => Alert.alert('Could not remove', e instanceof Error ? e.message : 'Try again.'),
  });

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Reviews</Text>
      <PaginatedList<Review>
        queryKey={['admin-reviews']}
        fetchPage={(page) => listAdminReviews({ page, limit: 20 })}
        keyExtractor={(r) => r.id}
        emptyTitle="No reviews"
        emptySubtitle="Customer reviews will appear here."
        itemHeight={120}
        renderItem={(r) => (
          <Card style={{ gap: 6 }}>
            <View style={styles.row}>
              <Text style={{ color: t.warning }}>{'\u2605'.repeat(Math.round(r.rating))}</Text>
              <Text style={{ color: t.faint, fontSize: 12 }}>{formatDate(r.createdAt)}</Text>
            </View>
            {r.authorName ? <Text style={{ color: t.muted, fontSize: 13 }}>{r.authorName}</Text> : null}
            {r.comment ? <Text style={{ color: t.fg }}>{r.comment}</Text> : null}
            <Button
              label="Remove review"
              variant="danger"
              onPress={() =>
                Alert.alert('Remove review', 'This removes it from public view.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(r.id) },
                ])
              }
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
