/**
 * DateField / DateRangeField — a calendar-backed date picker.
 *
 * Built on RN `Modal` (via `Sheet`) rather than a native date-picker module so
 * the app stays dependency-free, matches the design tokens in both themes, and
 * behaves identically on iOS and Android.
 *
 * Dates are handled as **calendar dates** (`YYYY-MM-DD`, local time) — never
 * via `toISOString()`, which would shift the day for users east of UTC.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import React, { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/store/ThemeContext';
import { Button } from './Button';
import { Sheet } from './Sheet';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `YYYY-MM-DD` in the device's local calendar. */
export function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayOnly(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Display form — "Mon, 3 Nov 2026". Falls back to the raw value. */
export function formatDisplayDate(value: string | null | undefined): string {
  const d = parseDateOnly(value);
  if (!d) return value ?? '';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildMonth(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstDay }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface CalendarProps {
  /** Single date, or the range start when `range` is on. */
  value?: string | null;
  /** Range end (range mode only). */
  valueEnd?: string | null;
  min?: string | null;
  max?: string | null;
  range?: boolean;
  onSelect: (date: string) => void;
}

function Calendar({ value, valueEnd, min, max, range, onSelect }: CalendarProps) {
  const t = useTheme();
  const seed = parseDateOnly(value) ?? todayOnly();
  const [cursor, setCursor] = useState({ year: seed.getFullYear(), month: seed.getMonth() });

  const minDate = parseDateOnly(min);
  const maxDate = parseDateOnly(max);
  const cells = buildMonth(cursor.year, cursor.month);

  const shift = (delta: number) =>
    setCursor((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const isDisabled = (day: Date) =>
    Boolean((minDate && day < minDate) || (maxDate && day > maxDate));

  const start = parseDateOnly(value);
  const end = parseDateOnly(valueEnd);

  return (
    <View style={styles.calendar}>
      <View style={styles.calHeader}>
        <Pressable
          onPress={() => shift(-1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={({ pressed }) => [styles.navBtn, { backgroundColor: t.surface3 }, pressed && { opacity: 0.7 }]}
        >
          <ChevronLeft size={18} color={t.fg} />
        </Pressable>
        <Text style={[styles.calTitle, { color: t.fgStrong }]}>
          {MONTHS[cursor.month]} {cursor.year}
        </Text>
        <Pressable
          onPress={() => shift(1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={({ pressed }) => [styles.navBtn, { backgroundColor: t.surface3 }, pressed && { opacity: 0.7 }]}
        >
          <ChevronRight size={18} color={t.fg} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day, i) => (
          <Text key={`${day}-${i}`} style={[styles.weekday, { color: t.faint }]}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`pad-${index}`} style={styles.cell} />;
          const key = toDateOnly(day);
          const disabled = isDisabled(day);
          const isStart = Boolean(start && day.getTime() === start.getTime());
          const isEnd = Boolean(end && day.getTime() === end.getTime());
          const inRange = Boolean(start && end && day > start && day < end);
          const isSelected = isStart || isEnd;

          return (
            <Pressable
              key={key}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={formatDisplayDate(key)}
              onPress={() => onSelect(key)}
              style={({ pressed }) => [
                styles.cell,
                inRange && { backgroundColor: t.brandSoft },
                isSelected && styles.cellSelected,
                { backgroundColor: isSelected ? t.brand : undefined },
                pressed && !disabled && { opacity: 0.75 },
              ]}
            >
              <Text
                style={[
                  styles.cellText,
                  {
                    color: isSelected
                      ? t.brandFg
                      : disabled
                        ? t.faint
                        : inRange
                          ? t.brandSoftFg
                          : t.fg,
                  },
                  isSelected && styles.cellTextSelected,
                ]}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function FieldShell({
  label,
  error,
  hint,
  placeholder,
  displayValue,
  onPress,
  icon,
}: {
  label: string;
  error?: string;
  hint?: string;
  placeholder: string;
  displayValue: string;
  onPress: () => void;
  icon: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.shell}>
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          {
            borderColor: error ? t.danger : t.line,
            backgroundColor: t.surface2,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text
          style={[styles.fieldText, { color: displayValue ? t.fg : t.faint }]}
          numberOfLines={1}
        >
          {displayValue || placeholder}
        </Text>
        {icon}
      </Pressable>
      {error ? (
        <Text style={[styles.error, { color: t.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: t.faint }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export interface DateFieldProps {
  label: string;
  value?: string | null;
  onChange: (date: string) => void;
  /** Earliest selectable `YYYY-MM-DD` (inclusive). Defaults to yesterday. */
  min?: string | null;
  max?: string | null;
  placeholder?: string;
  error?: string;
  hint?: string;
}

export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  placeholder = 'Select a date',
  error,
  hint,
}: DateFieldProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <FieldShell
        label={label}
        error={error}
        hint={hint}
        placeholder={placeholder}
        displayValue={formatDisplayDate(value)}
        onPress={() => setOpen(true)}
        icon={<CalendarDays size={18} color={t.muted} />}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <Calendar
          value={value}
          min={min ?? toDateOnly(new Date(todayOnly().getTime() - 24 * 60 * 60 * 1000))}
          max={max}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

export interface DateRangeFieldProps {
  label: string;
  start?: string | null;
  end?: string | null;
  onChange: (start: string | null, end: string | null) => void;
  min?: string | null;
  max?: string | null;
  error?: string;
  hint?: string;
}

/**
 * Range picker with explicit confirm — the first tap sets the start, the second
 * sets the end, and tapping in reverse order swaps them.
 */
export function DateRangeField({
  label,
  start,
  end,
  onChange,
  min,
  max,
  error,
  hint,
}: DateRangeFieldProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(start ?? null);
  const [draftEnd, setDraftEnd] = useState<string | null>(end ?? null);

  const openSheet = () => {
    setDraftStart(start ?? null);
    setDraftEnd(end ?? null);
    setOpen(true);
  };

  const select = (date: string) => {
    if (!draftStart || draftEnd) {
      setDraftStart(date);
      setDraftEnd(null);
      return;
    }
    if (date < draftStart) {
      setDraftStart(date);
      setDraftEnd(null);
      return;
    }
    setDraftEnd(date);
  };

  const display = draftStart
    ? draftEnd
      ? `${formatDisplayDate(draftStart)} → ${formatDisplayDate(draftEnd)}`
      : `${formatDisplayDate(draftStart)} → …`
    : '';

  return (
    <>
      <FieldShell
        label={label}
        error={error}
        hint={hint}
        placeholder="Select start and end date"
        displayValue={display}
        onPress={openSheet}
        icon={<CalendarDays size={18} color={t.muted} />}
      />
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <View style={styles.sheetActions}>
            <Button
              label="Clear"
              variant="secondary"
              style={styles.sheetBtn}
              onPress={() => {
                setDraftStart(null);
                setDraftEnd(null);
              }}
            />
            <Button
              label={draftStart && draftEnd ? 'Apply dates' : 'Apply'}
              variant="primary"
              style={styles.sheetBtn}
              disabled={!draftStart}
              onPress={() => {
                onChange(draftStart, draftEnd);
                setOpen(false);
              }}
            />
          </View>
        }
      >
        <Calendar
          range
          value={draftStart}
          valueEnd={draftEnd}
          min={min ?? toDateOnly(todayOnly())}
          max={max}
          onSelect={select}
        />
        <Text style={[styles.rangeHint, { color: t.muted }]}>
          {draftStart && !draftEnd ? 'Now pick the end date.' : 'Tap a date to set the start.'}
        </Text>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldText: { fontSize: 15.5, flex: 1 },
  error: { fontSize: 13 },
  hint: { fontSize: 13 },
  calendar: { gap: 8 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calTitle: { fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  cellSelected: {},
  cellText: { fontSize: 14.5, fontWeight: '600' },
  cellTextSelected: { fontWeight: '800' },
  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetBtn: { flex: 1 },
  rangeHint: { fontSize: 13, textAlign: 'center', paddingBottom: 4 },
});
