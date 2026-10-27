/**
 * Admin users — role/status/search filters over every account, moderation
 * (suspend / reactivate / deactivate) and admin-driven user creation, all
 * handled through sheets.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Screen,
  Segmented,
  Sheet,
  SignInPrompt,
  TextField,
  type SegmentedOption,
} from '@/components/ui';
import {
  createAdminUser,
  listAdminUsers,
  moderateUser,
  type UserModerationAction,
} from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatDate, humanize, type StatusMeta } from '@/utils/format';
import type { User } from '@/types';

const ROLE_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'ADMIN', label: 'Admin' },
];

const STATUS_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
];

type CreateRole = 'CUSTOMER' | 'PARTNER' | 'ADMIN';

const CREATE_ROLES: SegmentedOption<CreateRole>[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'ADMIN', label: 'Admin' },
];

const ROLE_META: Record<string, StatusMeta> = {
  CUSTOMER: { label: 'Customer', tone: 'info' },
  PARTNER: { label: 'Partner', tone: 'accent' },
  ADMIN: { label: 'Admin', tone: 'warn' },
};

const USER_STATUS_META: Record<string, StatusMeta> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  DEACTIVATED: { label: 'Deactivated', tone: 'neutral' },
};

const ACTION_LABEL: Record<UserModerationAction, string> = {
  SUSPEND: 'Suspend',
  REACTIVATE: 'Reactivate',
  DEACTIVATE: 'Deactivate',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function actionsFor(user: User): UserModerationAction[] {
  if (user.role === 'ADMIN') return ['REACTIVATE'];
  if (user.status === 'SUSPENDED') return ['REACTIVATE', 'DEACTIVATE'];
  if (user.status === 'DEACTIVATED') return ['REACTIVATE', 'SUSPEND'];
  return ['SUSPEND', 'DEACTIVATE'];
}

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function AdminUsersScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user: sessionUser } = useSession();

  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [moderationTarget, setModerationTarget] = useState<User | null>(null);
  const [moderationAction, setModerationAction] = useState<UserModerationAction>('SUSPEND');
  const [moderationReason, setModerationReason] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    email: string;
    password: string;
    phone: string;
    role: CreateRole;
  }>({ name: '', email: '', password: '', phone: '', role: 'CUSTOMER' });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(value.trim()), 300);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const moderate = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: UserModerationAction; reason?: string }) =>
      moderateUser(id, action, reason),
    onSuccess: (_data, variables) => {
      const name = moderationTarget?.name ?? 'Account';
      setModerationTarget(null);
      setModerationReason('');
      setSuccessMessage(
        variables.action === 'REACTIVATE'
          ? `${name} can sign in again.`
          : `${name} was ${variables.action === 'SUSPEND' ? 'suspended' : 'deactivated'}.`,
      );
      invalidate();
    },
  });

  const create = useMutation({
    mutationFn: () =>
      createAdminUser({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
        phone: createForm.phone.trim() ? createForm.phone.trim() : undefined,
      }),
    onSuccess: () => {
      setCreateOpen(false);
      setCreateForm({ name: '', email: '', password: '', phone: '', role: 'CUSTOMER' });
      setSuccessMessage('Account created and invited to sign in.');
      invalidate();
    },
  });

  const openModeration = (target: User) => {
    setModerationTarget(target);
    setModerationAction(actionsFor(target)[0] ?? 'REACTIVATE');
    setModerationReason('');
    moderate.reset();
  };

  const closeModeration = () => {
    setModerationTarget(null);
    setModerationReason('');
    moderate.reset();
  };

  const availableActions = moderationTarget ? actionsFor(moderationTarget) : [];
  const reasonRequired = moderationAction === 'SUSPEND' && moderationReason.trim().length === 0;

  const submitModeration = () => {
    if (!moderationTarget) return;
    moderate.mutate({
      id: moderationTarget.id,
      action: moderationAction,
      reason: moderationReason.trim() ? moderationReason.trim() : undefined,
    });
  };

  const nameError = createForm.name.length > 0 && createForm.name.trim().length < 2 ? 'At least 2 characters.' : undefined;
  const emailError = createForm.email.length > 0 && !EMAIL_RE.test(createForm.email.trim()) ? 'Enter a valid email address.' : undefined;
  const passwordError = createForm.password.length > 0 && createForm.password.length < 8 ? 'At least 8 characters.' : undefined;
  const createValid =
    createForm.name.trim().length >= 2 && EMAIL_RE.test(createForm.email.trim()) && createForm.password.length >= 8;

  if (!sessionUser) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to manage users"
          subtitle="User administration is restricted to platform administrators."
          next="/(admin)/(tabs)/users"
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[styles.heading, { color: t.fgStrong }]}>Users</Text>
            <Text style={[styles.subheading, { color: t.muted }]}>
              Every customer, partner and admin account.
            </Text>
          </View>
          <Button label="New user" onPress={() => { create.reset(); setCreateOpen(true); }} />
        </View>
      </View>

      {successMessage ? (
        <View style={styles.successWrap}>
          <Banner tone="success" message={successMessage} actionLabel="Dismiss" onAction={() => setSuccessMessage(null)} />
        </View>
      ) : null}

      <PaginatedList<User>
        queryKey={['admin-users', role, status, search]}
        fetchPage={(page) =>
          listAdminUsers({
            page,
            limit: 20,
            q: search || undefined,
            role: role || undefined,
            status: status || undefined,
          })
        }
        keyExtractor={(u) => u.id}
        emptyTitle="No users found"
        emptySubtitle="Try a different filter or search term."
        itemHeight={120}
        header={
          <View style={styles.filters}>
            <TextField
              label="Search users"
              value={searchInput}
              onChangeText={onSearchChange}
              placeholder="Name or email"
              autoCapitalize="none"
              returnKeyType="search"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <Segmented options={ROLE_OPTIONS} value={role} onChange={setRole} equalWidth={false} />
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} equalWidth={false} />
            </ScrollView>
          </View>
        }
        renderItem={(u) => {
          const roleMeta = ROLE_META[u.role];
          const statusMeta = USER_STATUS_META[u.status ?? 'ACTIVE'];
          return (
            <Card style={styles.rowCard} onPress={() => openModeration(u)}>
              <View style={styles.rowTop}>
                <Avatar uri={u.avatarUrl} name={u.name} size={44} />
                <View style={styles.rowTitleWrap}>
                  <Text style={[styles.name, { color: t.fgStrong }]} numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                    {u.email}
                  </Text>
                  <Text style={[styles.meta, { color: t.faint }]}>Joined {formatDate(u.createdAt)}</Text>
                </View>
                <View style={styles.badges}>
                  <Badge label={roleMeta?.label ?? humanize(u.role)} tone={roleMeta?.tone ?? 'neutral'} />
                  <Badge label={statusMeta?.label ?? humanize(u.status ?? 'ACTIVE')} tone={statusMeta?.tone ?? 'neutral'} />
                </View>
              </View>
            </Card>
          );
        }}
      />

      {/* Moderation sheet */}
      <Sheet
        visible={moderationTarget !== null}
        onClose={closeModeration}
        title="Manage account"
        subtitle={moderationTarget ? `${moderationTarget.name} · ${moderationTarget.email}` : undefined}
        dismissOnBackdrop={false}
        footer={
          <Button
            label={`${ACTION_LABEL[moderationAction]} account`}
            variant={moderationAction === 'REACTIVATE' ? 'primary' : 'danger'}
            fullWidth
            disabled={reasonRequired}
            loading={moderate.isPending}
            onPress={submitModeration}
          />
        }
      >
        {availableActions.length > 1 ? (
          <Segmented
            options={availableActions.map((value) => ({ value, label: ACTION_LABEL[value] }))}
            value={moderationAction}
            onChange={setModerationAction}
          />
        ) : (
          <Text style={[styles.sheetNote, { color: t.muted }]}>
            Administrators can only be reactivated from here.
          </Text>
        )}
        {moderationAction !== 'REACTIVATE' ? (
          <TextField
            label={moderationAction === 'SUSPEND' ? 'Reason (required)' : 'Reason (optional)'}
            value={moderationReason}
            onChangeText={setModerationReason}
            placeholder="Shared with the account owner"
            multiline
            error={reasonRequired ? 'A reason is required to suspend an account.' : undefined}
          />
        ) : null}
        <Text style={[styles.sheetNote, { color: t.faint }]}>
          {moderationAction === 'REACTIVATE'
            ? 'The account is re-enabled immediately.'
            : 'Signed-in sessions are revoked for suspended and deactivated accounts.'}
        </Text>
        {moderate.isError ? <Banner tone="danger" message={messageFor(moderate.error)} /> : null}
      </Sheet>

      {/* Create-user sheet */}
      <Sheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create account"
        subtitle="Provision a customer, partner or admin login."
        dismissOnBackdrop={false}
        footer={
          <Button
            label="Create account"
            fullWidth
            disabled={!createValid}
            loading={create.isPending}
            onPress={() => create.mutate()}
          />
        }
      >
        <TextField
          label="Full name"
          value={createForm.name}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, name: value }))}
          placeholder="e.g. Priya Sharma"
          error={nameError}
        />
        <TextField
          label="Email"
          value={createForm.email}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, email: value }))}
          placeholder="name@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          error={emailError}
        />
        <TextField
          label="Temporary password"
          value={createForm.password}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, password: value }))}
          placeholder="At least 8 characters"
          secureTextEntry
          error={passwordError}
          hint="The account holder can change it after signing in."
        />
        <TextField
          label="Phone (optional)"
          value={createForm.phone}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, phone: value }))}
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
        />
        <View>
          <Text style={[styles.fieldLabel, { color: t.fg }]}>Role</Text>
          <Segmented
            options={CREATE_ROLES}
            value={createForm.role}
            onChange={(value) => setCreateForm((prev) => ({ ...prev, role: value }))}
          />
        </View>
        {create.isError ? <Banner tone="danger" message={messageFor(create.error)} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 13 },
  successWrap: { paddingHorizontal: 16, marginBottom: 12 },
  filters: { gap: 12 },
  filterRow: { gap: 8, paddingVertical: 2 },
  rowCard: { gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowTitleWrap: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  badges: { alignItems: 'flex-end', gap: 6 },
  sheetNote: { fontSize: 13, lineHeight: 18 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
});
