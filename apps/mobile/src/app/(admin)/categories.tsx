/**
 * Admin categories — full platform taxonomy (all types, incl. inactive) with
 * create and edit sheets. The endpoint returns the whole set, so this screen
 * uses a plain query + local filtering instead of PaginatedList.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkRow,
  Screen,
  Segmented,
  Sheet,
  Skeleton,
  TextField,
  type SegmentedOption,
} from '@/components/ui';
import {
  createCategory,
  listAdminCategories,
  updateCategory,
  type AdminCategory,
} from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { humanize } from '@/utils/format';

type CategoryType = 'WAREHOUSE' | 'EQUIPMENT' | 'SERVICE';

const TYPE_OPTIONS: SegmentedOption<CategoryType>[] = [
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SERVICE', label: 'Service' },
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 80) return 'Name must be 80 characters or fewer.';
  return undefined;
}

function validateSlug(slug: string): string | undefined {
  if (!SLUG_PATTERN.test(slug)) return 'Use lowercase letters, numbers and hyphens only.';
  return undefined;
}

export default function AdminCategoriesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useSession();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CategoryType | ''>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<CategoryType>('WAREHOUSE');

  const [editTarget, setEditTarget] = useState<AdminCategory | null>(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['admin-categories'],
    queryFn: listAdminCategories,
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: () =>
      createCategory({
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        type,
      }),
    onSuccess: (created) => {
      setCreateOpen(false);
      setName('');
      setSlug('');
      setType('WAREHOUSE');
      setSuccessMessage(`Category “${created.name}” created.`);
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      updateCategory(id, { name: editName.trim(), isActive: editActive }),
    onSuccess: () => {
      setEditTarget(null);
      setSuccessMessage('Category updated.');
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
    },
  });

  const openCreate = () => {
    setName('');
    setSlug('');
    setType('WAREHOUSE');
    create.reset();
    setCreateOpen(true);
  };

  const openEdit = (category: AdminCategory) => {
    setEditTarget(category);
    setEditName(category.name);
    setEditActive(category.isActive !== false);
    update.reset();
  };

  const nameError = createOpen ? validateName(name) : undefined;
  const slugError = createOpen && slug.trim() !== '' ? validateSlug(slug.trim()) : undefined;
  const editNameError = editTarget ? validateName(editName) : undefined;

  if (!user) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Categories</Text>
        <Banner tone="info" message="Sign in with an administrator account to manage categories." />
      </Screen>
    );
  }

  if (categories.isLoading) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Categories</Text>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={72} radius={12} />
        ))}
      </Screen>
    );
  }

  if (categories.isError) {
    return (
      <Screen>
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      </Screen>
    );
  }

  const all = categories.data ?? [];
  const query = search.trim().toLowerCase();
  const visible = all.filter(
    (c) =>
      (!typeFilter || c.type === typeFilter) &&
      (!query || c.name.toLowerCase().includes(query) || c.slug.includes(query)),
  );

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={categories.isRefetching}
            onRefresh={() => {
              void categories.refetch();
            }}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heading, { color: t.fgStrong }]}>Categories</Text>
        <Text style={[styles.subheading, { color: t.muted }]}>
          {all.length} categor{all.length === 1 ? 'y' : 'ies'} across warehouse, equipment and service listings.
        </Text>

        {successMessage ? (
          <Banner tone="success" message={successMessage} actionLabel="Dismiss" onAction={() => setSuccessMessage(null)} />
        ) : null}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or slug"
          placeholderTextColor={t.faint}
          accessibilityLabel="Search categories"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.search, { backgroundColor: t.surface2, borderColor: t.line, color: t.fg }]}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Segmented
            options={[{ value: '', label: 'All' }, ...TYPE_OPTIONS]}
            value={typeFilter}
            onChange={setTypeFilter}
            equalWidth={false}
          />
        </ScrollView>

        <Button label="New category" onPress={openCreate} fullWidth />

        {visible.length === 0 ? (
          <EmptyState
            title="No categories match"
            subtitle={query || typeFilter ? 'Try a different search or filter.' : 'Create the first category to get started.'}
          />
        ) : (
          visible.map((category) => {
            const meta = TYPE_OPTIONS.find((option) => option.value === category.type);
            return (
              <Card key={category.id} padded={false}>
                <LinkRow
                  label={category.name}
                  subtitle={`${category.slug}${meta ? ` · ${meta.label}` : ''}`}
                  value={category.isActive === false ? 'Inactive' : 'Active'}
                  onPress={() => openEdit(category)}
                />
              </Card>
            );
          })
        )}
      </ScrollView>

      <Sheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New category"
        dismissOnBackdrop={false}
        footer={
          <Button
            label="Create category"
            fullWidth
            disabled={!name.trim() || nameError != null || slugError != null}
            loading={create.isPending}
            onPress={() => create.mutate()}
          />
        }
      >
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Cold storage"
          error={name.length > 0 ? nameError : undefined}
        />
        <TextField
          label="Slug (optional)"
          value={slug}
          onChangeText={setSlug}
          placeholder={slugify(name) || 'cold-storage'}
          autoCapitalize="none"
          autoCorrect={false}
          error={slugError}
          hint={slug.trim() === '' && name.trim() ? `Will be saved as “${slugify(name)}”.` : undefined}
        />
        <View>
          <Text style={[styles.fieldLabel, { color: t.fg }]}>Type</Text>
          <Segmented options={TYPE_OPTIONS} value={type} onChange={setType} />
        </View>
        {create.isError ? <Banner tone="danger" message={messageFor(create.error)} /> : null}
      </Sheet>

      <Sheet
        visible={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Edit category"
        subtitle={editTarget?.slug}
        dismissOnBackdrop={false}
        footer={
          <Button
            label="Save changes"
            fullWidth
            disabled={
              !editName.trim() ||
              editNameError != null ||
              (editName.trim() === (editTarget?.name ?? '') && editActive === (editTarget?.isActive !== false))
            }
            loading={update.isPending}
            onPress={() => {
              if (editTarget) update.mutate({ id: editTarget.id });
            }}
          />
        }
      >
        <TextField
          label="Name"
          value={editName}
          onChangeText={setEditName}
          error={editName.length > 0 ? editNameError : undefined}
        />
        <Card padded={false}>
          <LinkRow
            label="Active"
            subtitle="Inactive categories stay hidden from listing forms"
            value={editActive ? 'On' : 'Off'}
            hideChevron
            onPress={() => setEditActive((prev) => !prev)}
          />
        </Card>
        <View style={styles.editMeta}>
          <Badge label={TYPE_OPTIONS.find((o) => o.value === editTarget?.type)?.label ?? humanize(editTarget?.type ?? '')} tone="neutral" />
        </View>
        {update.isError ? <Banner tone="danger" message={messageFor(update.error)} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, flex: 1 },
  scrollContent: { gap: 12, paddingBottom: 32 },
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 13, marginTop: -4 },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  filters: { gap: 8, paddingVertical: 2 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  editMeta: { flexDirection: 'row' },
});
