/**
 * Edit profile — name, phone and avatar photo.
 *
 * The photo flow: expo-image-picker → data URI → POST /uploads (avatars) →
 * PATCH /me with the hosted URL → refresh the session's user so the whole app
 * (tabs, conversation rows, …) picks up the new picture immediately.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { z } from 'zod';

import { Avatar, Banner, Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { updateProfile } from '@/services/api/account';
import { uploadFile, uriToDataUri } from '@/services/api/uploads';

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9][0-9 -]{7,16}$/, 'Enter a valid phone number')
    .nullish()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function EditProfileScreen() {
  const t = useTheme();
  const { user, refreshUser } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      phone: user?.phone ?? '',
    },
  });

  const pickPhoto = async () => {
    setUploadError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError('Allow photo access in Settings to update your picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;

    setUploading(true);
    try {
      const dataUri = await uriToDataUri(asset.uri);
      const { url } = await uploadFile({ file: dataUri, folder: 'avatars' });
      await updateProfile({ avatarUrl: url });
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload the photo.');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await updateProfile({ name: values.name, phone: values.phone || null });
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes.');
    }
  });

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: t.fgStrong }]}>Edit profile</Text>

      {saved ? (
        <Banner
          tone="success"
          title="Saved"
          message="Your profile has been updated."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      ) : null}
      {error ? <Banner tone="danger" message={error} /> : null}
      {uploadError ? <Banner tone="danger" message={uploadError} /> : null}

      {/* Avatar + photo picker */}
      <View style={styles.avatarSection}>
        <Avatar uri={user?.avatarUrl} name={user?.name} size={96} />
        <Button
          label={uploading ? 'Uploading…' : 'Change photo'}
          variant="secondary"
          onPress={pickPhoto}
          loading={uploading}
          disabled={uploading}
        />
        <View style={styles.hintRow}>
          <Camera size={14} color={t.faint} />
          <Text style={[styles.hint, { color: t.faint }]}>
            JPEG or PNG, square works best.
          </Text>
        </View>
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Full name"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.name?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Phone"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.phone?.message}
            keyboardType="phone-pad"
            placeholder="+91 98765 43210"
          />
        )}
      />
      <Button
        label="Save changes"
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={uploading}
        fullWidth
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800' },
  avatarSection: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { fontSize: 12.5 },
});
