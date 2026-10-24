/** Themed text field with label, error message and secure-entry support. */

import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/store/ThemeContext';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

type TextInputInstance = React.ElementRef<typeof TextInput>;

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, error, hint, style, ...rest },
  ref,
) {
  const t = useTheme();
  const borderColor = error ? t.danger : t.line;
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={t.faint}
        style={[
          styles.input,
          { borderColor, backgroundColor: t.surface2, color: t.fg },
          rest.multiline && styles.multiline,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[styles.error, { color: t.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: t.faint }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  error: { fontSize: 13 },
  hint: { fontSize: 13 },
});