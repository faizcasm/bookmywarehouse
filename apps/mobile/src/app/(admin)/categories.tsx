/** Admin categories — list + create (no delete endpoint on the API). */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminCategories, createCategory, type AdminCategory } from '@/services/api/admin';
import { humanize } from '@/utils/format';

const TYPES = ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] as const;

export default function AdminCategoriesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<string>('WAREHOUSE');

  const categories = useQuery({ queryKey: ['admin-categories'], queryFn: listAdminCategories });

  const create = useMutation({
    mutationFn: () =>
      createCategory({
        name: name.trim(),
        slug: slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        type,
      }),
    onSuccess: () => {
      Alert.alert('Category created');
      setName('');
      setSlug('');
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
    },
    onError: (e) => Alert.alert('Could not create', e instanceof Error ? e.message : 'Try again.'),
  });

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Categories</Text>

      <Card style={{ gap: 12 }}>
        <Text style={{ color: t.fgStrong, fontWeight: '700' }}>New category</Text>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Cold storage" />
        <TextField label="Slug (optional)" value={slug} onChangeText={setSlug} placeholder="cold-storage" autoCapitalize="none" />
        <View>
          <Text style={{ color: t.fg, fontWeight: '600', marginBottom: 6 }}>Type</Text>
          <View style={styles.chipRow}>
            {TYPES.map((tt) => {
              const active = type === tt;
              return (
                <Text
                  key={tt}
                  onPress={() => setType(tt)}
                  style={[styles.chip, { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg }]}
                >
                  {humanize(tt)}
                </Text>
              );
            })}
          </View>
        </View>
        <Button
          label="Create category"
          onPress={() => create.mutate()}
          loading={create.isPending}
          disabled={!name.trim()}
          fullWidth
        />
      </Card>

      {categories.isLoading ? (
        [0, 1].map((i) => <Skeleton key={i} height={60} radius={12} />)
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      ) : (
        (categories.data ?? []).map((cat: AdminCategory) => (
          <Card key={cat.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.fgStrong, fontWeight: '600' }}>{cat.name}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>
                  {cat.slug}
                  {cat.type ? ` · ${humanize(cat.type)}` : ''}
                  {cat.isActive === false ? ' · inactive' : ''}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, overflow: 'hidden', fontSize: 13, fontWeight: '600' },
});
