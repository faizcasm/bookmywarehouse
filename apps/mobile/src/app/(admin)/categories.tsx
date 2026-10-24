/** Admin categories — list + create/delete. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminCategories, createCategory, deleteCategory } from '@/services/api/admin';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
}

export default function AdminCategoriesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const categories = useQuery({ queryKey: ['admin-categories'], queryFn: listAdminCategories });

  const create = useMutation({
    mutationFn: () => createCategory({ name: name.trim(), slug: slug.trim() || name.trim().toLowerCase().replace(/\s+/g, '-') }),
    onSuccess: () => {
      Alert.alert('Category created');
      setName('');
      setSlug('');
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
    },
    onError: (e) => Alert.alert('Could not create', e instanceof Error ? e.message : 'Try again.'),
  });

  const remove = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
    onError: (e) => Alert.alert('Could not delete', e instanceof Error ? e.message : 'In use or not found.'),
  });

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Categories</Text>

      <Card style={{ gap: 12 }}>
        <Text style={{ color: t.fgStrong, fontWeight: '700' }}>New category</Text>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Cold storage" />
        <TextField label="Slug (optional)" value={slug} onChangeText={setSlug} placeholder="cold-storage" autoCapitalize="none" />
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
        (categories.data ?? []).map((c) => {
          const cat = c as CategoryRow;
          return (
            <Card key={cat.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.fgStrong, fontWeight: '600' }}>{cat.name}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{cat.slug}</Text>
                </View>
                <Text
                  onPress={() =>
                    Alert.alert('Delete category', `Delete "${cat.name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(cat.id) },
                    ])
                  }
                  style={{ color: t.danger, fontWeight: '600' }}
                >
                  Delete
                </Text>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
