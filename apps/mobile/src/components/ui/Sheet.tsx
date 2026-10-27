/**
 * Sheet — a themed bottom sheet (RN Modal, no extra native dependency).
 *
 * Used for filters, reason pickers, confirmations and the date picker so every
 * "pick something" interaction in the app behaves the same way.
 */

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/store/ThemeContext';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Footer actions pinned under the content (e.g. Apply / Reset). */
  footer?: React.ReactNode;
  /** Disable backdrop-tap dismissal (for destructive flows). */
  dismissOnBackdrop?: boolean;
}

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  dismissOnBackdrop = true,
}: SheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        accessibilityLabel="Close"
        onPress={dismissOnBackdrop ? onClose : undefined}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: t.surface,
            borderTopColor: t.line,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: t.lineStrong }]} />
        {title ? (
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: t.fgStrong }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: t.muted }]}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.close, { backgroundColor: t.surface3 }, pressed && { opacity: 0.7 }]}
            >
              <X size={18} color={t.fg} />
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {footer ? <View style={[styles.footer, { borderTopColor: t.line }]}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,6,23,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  content: { gap: 12, paddingBottom: 8 },
  footer: { paddingTop: 12, marginTop: 4, gap: 8 },
});
