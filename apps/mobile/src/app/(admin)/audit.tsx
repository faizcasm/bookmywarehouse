/**
 * Admin audit log — read-only trail of admin and system actions with
 * action/entity filters and a detail sheet (full record as JSON).
 */

import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Badge,
  Banner,
  Button,
  Card,
  Screen,
  Segmented,
  Sheet,
  type SegmentedOption,
} from '@/components/ui';
import { listAuditLogs } from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatDateTime, humanize } from '@/utils/format';

/**
 * The audit endpoint populates `actor` as an object, but the frozen service
 * types it as `string | null`. Narrow to the real shape before rendering.
 */
interface AuditActor {
  id: string;
  name?: string;
  role?: string;
}

interface AuditLogEntry {
  id: string;
  actor?: AuditActor | string | null;
  action?: string;
  entityType?: string;
  entityId?: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt?: string;
}

function actorName(actor: AuditLogEntry['actor']): string {
  if (actor && typeof actor === 'object' && actor.name) return actor.name;
  if (typeof actor === 'string' && actor) return actor;
  return 'System';
}

const ENTITY_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'User', label: 'Users' },
  { value: 'PartnerProfile', label: 'Partners' },
  { value: 'Listing', label: 'Listings' },
  { value: 'Booking', label: 'Bookings' },
  { value: 'Payment', label: 'Payments' },
  { value: 'Dispute', label: 'Disputes' },
  { value: 'Review', label: 'Reviews' },
  { value: 'Category', label: 'Categories' },
];

const DEBOUNCE_MS = 350;

export default function AdminAuditScreen() {
  const t = useTheme();
  const { user } = useSession();

  const [actionInput, setActionInput] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onActionChange = (value: string) => {
    setActionInput(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAction(value.trim()), DEBOUNCE_MS);
  };

  if (!user) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Audit log</Text>
        <Banner tone="info" message="Sign in with an administrator account to view the audit log." />
      </Screen>
    );
  }

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Audit log</Text>

      <PaginatedList<AuditLogEntry>
        queryKey={['admin-audit', action, entityType]}
        fetchPage={async (page) => {
          const query: Record<string, string | number> = { page, limit: 30 };
          if (action) query.action = action;
          if (entityType) query.entityType = entityType;
          const res = await listAuditLogs(query);
          return { ...res, items: res.items as AuditLogEntry[] };
        }}
        keyExtractor={(a) => a.id}
        emptyTitle="No audit entries"
        emptySubtitle="Admin actions matching these filters will appear here."
        itemHeight={110}
        header={
          <View style={styles.headerWrap}>
            <TextInput
              value={actionInput}
              onChangeText={onActionChange}
              placeholder="Filter by action (e.g. dispute)"
              placeholderTextColor={t.faint}
              accessibilityLabel="Filter audit log by action"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.search, { backgroundColor: t.surface2, borderColor: t.line, color: t.fg }]}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Segmented
                options={ENTITY_OPTIONS}
                value={entityType}
                onChange={setEntityType}
                equalWidth={false}
              />
            </ScrollView>
          </View>
        }
        renderItem={(a) => (
          <Card style={styles.card} onPress={() => setDetail(a)}>
            <View style={styles.rowTop}>
              <View style={styles.rowText}>
                <Text style={[styles.action, { color: t.fgStrong }]} numberOfLines={1}>
                  {humanize(a.action ?? '')}
                </Text>
                <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                  {a.summary ?? ''}
                </Text>
                <Text style={[styles.meta, { color: t.faint }]}>
                  {humanize(a.entityType ?? '')}
                  {a.entityId ? ` · ${a.entityId.slice(0, 8)}` : ''} · {formatDateTime(a.createdAt)}
                </Text>
              </View>
              <Badge label={actorName(a.actor)} tone="neutral" />
            </View>
          </Card>
        )}
      />

      <Sheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? humanize(detail.action ?? 'Audit entry') : undefined}
        subtitle={detail ? formatDateTime(detail.createdAt) : undefined}
        footer={<Button label="Close" variant="secondary" fullWidth onPress={() => setDetail(null)} />}
      >
        {detail ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={[styles.json, { color: t.fg, backgroundColor: t.surface2 }]}>
              {JSON.stringify(detail, null, 2)}
            </Text>
          </ScrollView>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  headerWrap: { gap: 10, marginBottom: 4 },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  filters: { gap: 8, paddingVertical: 2 },
  card: { gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowText: { flex: 1, gap: 2 },
  action: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13 },
  json: { fontSize: 12, fontFamily: 'monospace', borderRadius: 12, padding: 12 },
});
