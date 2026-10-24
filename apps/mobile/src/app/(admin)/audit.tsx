/** Admin audit log — read-only trail of admin actions. */

import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAuditLogs } from '@/services/api/admin';
import { formatDateTime, humanize } from '@/utils/format';

interface AuditRow {
  id: string;
  action: string;
  actor?: string;
  targetType?: string;
  targetId?: string;
  createdAt: string;
}

export default function AdminAuditScreen() {
  const t = useTheme();

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Audit log</Text>
      <PaginatedList<AuditRow>
        queryKey={['admin-audit']}
        fetchPage={(page) => listAuditLogs<AuditRow>({ page, limit: 30 })}
        keyExtractor={(a) => a.id}
        emptyTitle="No audit entries"
        emptySubtitle="Admin actions are recorded here."
        itemHeight={90}
        renderItem={(a) => (
          <Card style={{ gap: 2 }}>
            <Text style={{ color: t.fgStrong, fontWeight: '600' }}>{humanize(a.action)}</Text>
            {a.actor ? <Text style={{ color: t.muted, fontSize: 13 }}>by {a.actor}</Text> : null}
            {a.targetType ? (
              <Text style={{ color: t.faint, fontSize: 12 }}>
                {humanize(a.targetType)}
                {a.targetId ? ` · ${a.targetId.slice(0, 8)}` : ''}
              </Text>
            ) : null}
            <Text style={{ color: t.faint, fontSize: 12 }}>{formatDateTime(a.createdAt)}</Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
});
