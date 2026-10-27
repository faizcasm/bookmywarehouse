/**
 * Listing availability — weekly open-hours rules plus blocked (or specially
 * opened) dates.
 *
 * The API models rules and exceptions as separate resources:
 *  - a rule re-opens the same weekdays each week (POST/DELETE /availability-rules);
 *  - an exception blocks or opens a single date (POST/DELETE /availability-exceptions).
 * There is no PATCH, so "editing" a rule is implemented as remove + re-add and
 * bulk blocking a range fans out into one exception per day (capped at 31 so a
 * fat-fingered range can't hammer the API).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarOff, Clock, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  DateRangeField,
  EmptyState,
  ErrorState,
  formatDisplayDate,
  Screen,
  Segmented,
  Sheet,
  SignInPrompt,
  Skeleton,
  TextField,
} from '@/components/ui';
import {
  addAvailabilityException,
  addAvailabilityRule,
  getListingAvailability,
  getPartnerListing,
  removeAvailabilityException,
  removeAvailabilityRule,
} from '@/services/api/partner';
import { ApiError } from '@/services/api/client';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatDaysOfWeek } from '@/utils/format';
import type { AvailabilityExceptionDTO, AvailabilityRuleDTO } from '@bmw/shared-types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_BLOCK_DAYS = 31;

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Try again.';

/** Expand a `YYYY-MM-DD` range into individual calendar dates (device-local). */
function expandDates(start: string, end: string): string[] {
  const parse = (value: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };
  const cursor = parse(start);
  const last = parse(end) ?? cursor;
  if (!cursor || !last) return [];
  const dates: string[] = [];
  while (cursor.getTime() <= last.getTime() && dates.length <= MAX_BLOCK_DAYS) {
    const month = `${cursor.getMonth() + 1}`.padStart(2, '0');
    const day = `${cursor.getDate()}`.padStart(2, '0');
    dates.push(`${cursor.getFullYear()}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function AvailabilityPanel({ listingId }: { listingId: string }) {
  const t = useTheme();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'rules' | 'blocked'>('rules');
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add-rule sheet state.
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleDays, setRuleDays] = useState<number[]>([]);
  const [ruleStart, setRuleStart] = useState('09:00');
  const [ruleEnd, setRuleEnd] = useState('18:00');
  const [ruleFrom, setRuleFrom] = useState<string | null>(null);
  const [ruleTo, setRuleTo] = useState<string | null>(null);
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});

  // Block-dates sheet state.
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockFrom, setBlockFrom] = useState<string | null>(null);
  const [blockTo, setBlockTo] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);

  // Destructive confirmations.
  const [ruleToDelete, setRuleToDelete] = useState<AvailabilityRuleDTO | null>(null);
  const [exceptionToDelete, setExceptionToDelete] = useState<AvailabilityExceptionDTO | null>(null);

  const availability = useQuery({
    queryKey: ['partner-listing-availability', listingId],
    queryFn: () => getListingAvailability(listingId),
    enabled: listingId !== '',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['partner-listing-availability', listingId] });
    qc.invalidateQueries({ queryKey: ['partner-listing', listingId] });
  };

  const succeed = (message: string) => {
    setActionError(null);
    setNotice(message);
    invalidate();
  };

  const addRule = useMutation({
    mutationFn: () =>
      addAvailabilityRule({
        listingId,
        daysOfWeek: [...ruleDays].sort((a, b) => a - b),
        startTime: ruleStart.trim(),
        endTime: ruleEnd.trim(),
        startDate: ruleFrom,
        endDate: ruleTo,
      }),
    onSuccess: () => {
      setRuleOpen(false);
      resetRuleForm();
      succeed('Weekly hours added.');
    },
    onError: (e) => setActionError(errorText(e)),
  });

  const deleteRule = useMutation({
    mutationFn: (ruleId: string) => removeAvailabilityRule(ruleId),
    onSuccess: () => {
      setRuleToDelete(null);
      succeed('Weekly hours removed.');
    },
    onError: (e) => setActionError(errorText(e)),
  });

  const blockDates = useMutation({
    mutationFn: async () => {
      const dates = expandDates(blockFrom ?? '', blockTo ?? blockFrom ?? '');
      const reason = blockReason.trim();
      for (const date of dates) {
        // Sequential on purpose — keeps server load predictable and surfaces
        // the first failing day instead of racing partial writes.
        await addAvailabilityException({
          listingId,
          date,
          reason: reason === '' ? null : reason,
          isAvailable: false,
        });
      }
      return dates.length;
    },
    onSuccess: (count) => {
      setBlockOpen(false);
      setBlockFrom(null);
      setBlockTo(null);
      setBlockReason('');
      succeed(`${count} ${count === 1 ? 'date' : 'dates'} blocked.`);
    },
    onError: (e) => {
      // Keep the sheet open — a mid-range failure may have blocked some days.
      setBlockError(errorText(e));
      invalidate();
    },
  });

  const deleteException = useMutation({
    mutationFn: (exceptionId: string) => removeAvailabilityException(exceptionId),
    onSuccess: () => {
      setExceptionToDelete(null);
      succeed('Date removed — the regular schedule applies again.');
    },
    onError: (e) => setActionError(errorText(e)),
  });

  const resetRuleForm = () => {
    setRuleDays([]);
    setRuleStart('09:00');
    setRuleEnd('18:00');
    setRuleFrom(null);
    setRuleTo(null);
    setRuleErrors({});
  };

  const submitRule = () => {
    const errors: Record<string, string> = {};
    if (ruleDays.length === 0) errors.days = 'Select at least one day.';
    if (!TIME_RE.test(ruleStart.trim())) errors.start = 'Use 24h HH:mm, e.g. 09:00.';
    if (!TIME_RE.test(ruleEnd.trim())) errors.end = 'Use 24h HH:mm, e.g. 18:00.';
    if (ruleFrom && ruleTo && ruleTo < ruleFrom) errors.range = 'The end date is before the start date.';
    setRuleErrors(errors);
    if (Object.keys(errors).length === 0) addRule.mutate();
  };

  const submitBlock = () => {
    if (!blockFrom) {
      setBlockError('Pick at least one date to block.');
      return;
    }
    const dates = expandDates(blockFrom, blockTo ?? blockFrom);
    if (dates.length > MAX_BLOCK_DAYS) {
      setBlockError(`Pick at most ${MAX_BLOCK_DAYS} days per batch.`);
      return;
    }
    setBlockError(null);
    blockDates.mutate();
  };

  const busy =
    addRule.isPending ||
    deleteRule.isPending ||
    blockDates.isPending ||
    deleteException.isPending;

  if (availability.isLoading) {
    return (
      <View style={styles.panel}>
        <Skeleton height={44} radius={12} />
        <Skeleton height={100} radius={t.radiusLg} />
        <Skeleton height={100} radius={t.radiusLg} />
      </View>
    );
  }

  if (availability.isError || !availability.data) {
    return (
      <ErrorState
        error={availability.error}
        onRetry={
          availability.error instanceof ApiError && availability.error.status === 404
            ? undefined
            : () => availability.refetch()
        }
      />
    );
  }

  const { rules, blockedDates } = availability.data;
  const upcoming = [...blockedDates].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <View style={styles.panel}>
      {notice ? (
        <Banner tone="success" message={notice} actionLabel="Dismiss" onAction={() => setNotice(null)} />
      ) : null}
      {actionError ? <Banner tone="danger" message={actionError} /> : null}

      <Segmented
        options={[
          { value: 'rules', label: 'Weekly hours', count: rules.length },
          { value: 'blocked', label: 'Blocked dates', count: upcoming.length },
        ]}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setNotice(null);
          setActionError(null);
        }}
      />

      {tab === 'rules' ? (
        <>
          <Button
            label="Add weekly hours"
            variant="secondary"
            fullWidth
            disabled={busy}
            onPress={() => {
              setNotice(null);
              setActionError(null);
              setRuleOpen(true);
            }}
          />
          {rules.length === 0 ? (
            <EmptyState
              title="No weekly hours set"
              subtitle="Without rules customers can request any date that isn’t blocked below."
            />
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} style={styles.ruleCard}>
                <View style={styles.ruleHeader}>
                  <Clock size={18} color={t.brand} />
                  <View style={styles.ruleText}>
                    <Text style={[styles.ruleTitle, { color: t.fgStrong }]}>
                      {formatDaysOfWeek(rule.daysOfWeek)} · {rule.startTime}–{rule.endTime}
                    </Text>
                    {rule.startDate || rule.endDate ? (
                      <Text style={{ color: t.muted, fontSize: 12.5 }}>
                        {formatDisplayDate(rule.startDate ?? null)}
                        {rule.endDate ? ` → ${formatDisplayDate(rule.endDate)}` : ' → onward'}
                      </Text>
                    ) : (
                      <Text style={{ color: t.faint, fontSize: 12.5 }}>Repeats every week</Text>
                    )}
                  </View>
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${formatDaysOfWeek(rule.daysOfWeek)} hours`}
                    disabled={busy}
                    onPress={() => {
                      setActionError(null);
                      setRuleToDelete(rule);
                    }}
                    style={styles.iconButton}
                  >
                    <Trash2 size={18} color={t.danger} />
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </>
      ) : (
        <>
          <Button
            label="Block dates"
            variant="secondary"
            fullWidth
            disabled={busy}
            onPress={() => {
              setNotice(null);
              setActionError(null);
              setBlockOpen(true);
            }}
          />
          {upcoming.length === 0 ? (
            <EmptyState
              title="No blocked dates"
              subtitle="Block maintenance days, holidays, or fully booked ranges here."
            />
          ) : (
            upcoming.map((exception) => (
              <Card key={exception.id} style={styles.ruleCard}>
                <View style={styles.ruleHeader}>
                  <CalendarOff size={18} color={exception.isAvailable ? t.success : t.warning} />
                  <View style={styles.ruleText}>
                    <Text style={[styles.ruleTitle, { color: t.fgStrong }]}>
                      {formatDisplayDate(exception.date)}
                    </Text>
                    {exception.reason ? (
                      <Text style={{ color: t.muted, fontSize: 12.5 }} numberOfLines={2}>
                        {exception.reason}
                      </Text>
                    ) : null}
                  </View>
                  <Badge
                    label={exception.isAvailable ? 'Extra open' : 'Blocked'}
                    tone={exception.isAvailable ? 'success' : 'warn'}
                  />
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Unblock ${formatDisplayDate(exception.date)}`}
                    disabled={busy}
                    onPress={() => {
                      setActionError(null);
                      setExceptionToDelete(exception);
                    }}
                    style={styles.iconButton}
                  >
                    <Trash2 size={18} color={t.danger} />
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </>
      )}

      {/* Add weekly hours */}
      <Sheet
        visible={ruleOpen}
        onClose={() => setRuleOpen(false)}
        title="Add weekly hours"
        subtitle="The listing accepts requests on these days between these times."
        dismissOnBackdrop={false}
        footer={
          <View style={styles.footerRow}>
            <Button
              label="Cancel"
              variant="secondary"
              style={styles.flex}
              disabled={addRule.isPending}
              onPress={() => setRuleOpen(false)}
            />
            <Button
              label={addRule.isPending ? 'Saving…' : 'Add hours'}
              style={styles.flex}
              loading={addRule.isPending}
              onPress={submitRule}
            />
          </View>
        }
      >
        <Text style={[styles.fieldLabel, { color: t.fg }]}>Days of the week</Text>
        <View style={styles.chipRow}>
          {DAY_NAMES.map((day, index) => (
            <Chip
              key={day}
              size="sm"
              label={day}
              selected={ruleDays.includes(index)}
              onPress={() =>
                setRuleDays((current) =>
                  current.includes(index)
                    ? current.filter((value) => value !== index)
                    : [...current, index],
                )
              }
            />
          ))}
        </View>
        {ruleErrors.days ? (
          <Text style={[styles.error, { color: t.danger }]}>{ruleErrors.days}</Text>
        ) : null}
        <View style={styles.rowGap}>
          <View style={styles.flex}>
            <TextField
              label="Start time"
              value={ruleStart}
              onChangeText={setRuleStart}
              error={ruleErrors.start}
              placeholder="09:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              accessibilityLabel="Start time, 24 hour HH colon mm"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="End time"
              value={ruleEnd}
              onChangeText={setRuleEnd}
              error={ruleErrors.end}
              placeholder="18:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              accessibilityLabel="End time, 24 hour HH colon mm"
            />
          </View>
        </View>
        <DateRangeField
          label="Effective range (optional)"
          start={ruleFrom}
          end={ruleTo}
          error={ruleErrors.range}
          hint="Leave empty for a rule that repeats every week."
          onChange={(start, end) => {
            setRuleFrom(start);
            setRuleTo(end);
          }}
        />
        {addRule.isError ? <Banner tone="danger" message={errorText(addRule.error)} /> : null}
      </Sheet>

      {/* Block dates */}
      <Sheet
        visible={blockOpen}
        onClose={() => setBlockOpen(false)}
        title="Block dates"
        subtitle="Customers can’t request bookings on blocked dates."
        dismissOnBackdrop={false}
        footer={
          <View style={styles.footerRow}>
            <Button
              label="Cancel"
              variant="secondary"
              style={styles.flex}
              disabled={blockDates.isPending}
              onPress={() => setBlockOpen(false)}
            />
            <Button
              label={blockDates.isPending ? 'Blocking…' : 'Block dates'}
              style={styles.flex}
              loading={blockDates.isPending}
              onPress={submitBlock}
            />
          </View>
        }
      >
        <DateRangeField
          label="Dates to block"
          start={blockFrom}
          end={blockTo}
          hint={`A single day or a range — up to ${MAX_BLOCK_DAYS} days at a time.`}
          onChange={(start, end) => {
            setBlockFrom(start);
            setBlockTo(end);
            setBlockError(null);
          }}
        />
        <TextField
          label="Reason (optional)"
          value={blockReason}
          onChangeText={setBlockReason}
          placeholder="e.g. Annual maintenance"
          maxLength={300}
          accessibilityLabel="Reason for blocking these dates"
        />
        {blockError ? <Banner tone="danger" message={blockError} /> : null}
      </Sheet>

      {/* Remove-rule confirmation */}
      <Sheet
        visible={ruleToDelete !== null}
        onClose={() => setRuleToDelete(null)}
        title="Remove these weekly hours?"
        subtitle={
          ruleToDelete
            ? `${formatDaysOfWeek(ruleToDelete.daysOfWeek)} · ${ruleToDelete.startTime}–${ruleToDelete.endTime}`
            : undefined
        }
        dismissOnBackdrop={false}
        footer={
          <View style={styles.footerRow}>
            <Button
              label="Keep"
              variant="secondary"
              style={styles.flex}
              disabled={deleteRule.isPending}
              onPress={() => setRuleToDelete(null)}
            />
            <Button
              label="Remove"
              variant="danger"
              style={styles.flex}
              loading={deleteRule.isPending}
              onPress={() => ruleToDelete && deleteRule.mutate(ruleToDelete.id)}
            />
          </View>
        }
      >
        {deleteRule.isError ? <Banner tone="danger" message={errorText(deleteRule.error)} /> : null}
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
          The listing keeps its other rules; days without a rule fall back to “always open”
          unless they’re blocked below.
        </Text>
      </Sheet>

      {/* Unblock confirmation */}
      <Sheet
        visible={exceptionToDelete !== null}
        onClose={() => setExceptionToDelete(null)}
        title={exceptionToDelete?.isAvailable ? 'Remove extra open date?' : 'Unblock this date?'}
        subtitle={exceptionToDelete ? formatDisplayDate(exceptionToDelete.date) : undefined}
        dismissOnBackdrop={false}
        footer={
          <View style={styles.footerRow}>
            <Button
              label="Cancel"
              variant="secondary"
              style={styles.flex}
              disabled={deleteException.isPending}
              onPress={() => setExceptionToDelete(null)}
            />
            <Button
              label={exceptionToDelete?.isAvailable ? 'Remove' : 'Unblock'}
              variant="danger"
              style={styles.flex}
              loading={deleteException.isPending}
              onPress={() => exceptionToDelete && deleteException.mutate(exceptionToDelete.id)}
            />
          </View>
        }
      >
        {deleteException.isError ? (
          <Banner tone="danger" message={errorText(deleteException.error)} />
        ) : null}
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
          The regular weekly schedule applies to this date again.
        </Text>
      </Sheet>
    </View>
  );
}

export default function PartnerListingAvailabilityScreen() {
  const t = useTheme();
  const { user } = useSession();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const id = listingId ?? '';

  const listing = useQuery({
    queryKey: ['partner-listing', id],
    queryFn: () => getPartnerListing(id),
    enabled: Boolean(id) && Boolean(user),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to manage availability"
          subtitle="Weekly hours and blocked dates are managed from your partner account."
          next={`/(partner)/availability/${id}`}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.backBar}>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to availability"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(partner)/availability'))}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={t.fg} />
          <Text style={[styles.backTitle, { color: t.fgStrong }]} numberOfLines={1}>
            {listing.data?.title ?? 'Availability'}
          </Text>
        </Pressable>
      </View>
      {listing.isLoading ? <Skeleton height={24} width="60%" radius={8} /> : null}
      <AvailabilityPanel listingId={id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backBar: { marginBottom: 4 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  backTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  panel: { gap: 12 },
  ruleCard: { padding: 14 },
  ruleHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleText: { flex: 1, gap: 2 },
  ruleTitle: { fontSize: 14.5, fontWeight: '700' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600' },
  error: { fontSize: 13, marginTop: -4 },
  rowGap: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  footerRow: { flexDirection: 'row', gap: 10 },
});
