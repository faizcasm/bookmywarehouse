/** New listing — guided form covering the create-listing contract. */

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, Card, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { createListing } from '@/services/api/partner';
import { getCategories } from '@/services/api/catalog';
import { uploadFile } from '@/services/api/uploads';
import { ApiError } from '@/services/api/client';

const schema = z.object({
  title: z.string().trim().min(4, 'Title must be at least 4 characters').max(120),
  type: z.enum(['WAREHOUSE', 'EQUIPMENT', 'SERVICE']),
  categoryId: z.string().min(1, 'Pick a category'),
  addressLine: z.string().trim().min(4, 'Enter the address'),
  city: z.string().trim().min(2, 'Enter the city'),
  state: z.string().trim().min(2, 'Enter the state'),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, 'Enter a 6-digit pincode'),
  description: z.string().max(2000).optional(),
  capacityValue: z.number().positive('Enter a capacity'),
  capacityUnit: z.string().min(1, 'Enter a unit'),
  pricingPeriod: z.string().min(1, 'Pick a period'),
  basePrice: z.number().positive('Enter a price'),
});

type FormValues = z.infer<typeof schema>;

const PERIODS = ['HOUR', 'DAY', 'WEEK', 'MONTH'];
const UNITS = ['SQFT', 'PALLET', 'UNIT', 'TON'];

export default function NewListingScreen() {
  const t = useTheme();
  const [cover, setCover] = useState<{ uri: string; publicId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'WAREHOUSE', pricingPeriod: 'DAY', capacityUnit: 'SQFT' },
  });

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a cover image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    try {
      const publicId = await uploadViaUri(asset.uri, asset.mimeType ?? 'image/jpeg');
      setCover({ uri: asset.uri, publicId });
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload the image.');
    }
  };

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      createListing({
        title: values.title,
        type: values.type,
        categoryId: values.categoryId,
        addressLine: values.addressLine,
        city: values.city,
        state: values.state,
        pincode: values.pincode,
        description: values.description,
        capacityValue: values.capacityValue,
        capacityUnit: values.capacityUnit,
        pricingPeriod: values.pricingPeriod,
        basePriceMinor: Math.round(values.basePrice * 100),
        coverImageId: cover?.publicId,
      }),
    onSuccess: () => {
      Alert.alert('Listing created', 'Your listing was saved as a draft. Publish it from the listings tab.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.issues.length) {
        setError(err.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
      } else {
        setError(err instanceof Error ? err.message : 'Could not create the listing.');
      }
    },
  });

  const onSubmit = handleSubmit((values) => create.mutate(values));

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>New listing</Text>
      {error ? (
        <View style={[styles.errorBox, { backgroundColor: t.dangerSoft }]}>
          <Text style={{ color: t.dangerSoftFg }}>{error}</Text>
        </View>
      ) : null}

      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField label="Title" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.title?.message} placeholder="e.g. 5,000 sqft warehouse with dock" />
        )}
      />

      <View>
        <Text style={[styles.label, { color: t.fg }]}>Type</Text>
        <View style={styles.chipRow}>
          {(['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] as const).map((type) => {
            const active = watch('type') === type;
            return (
              <Text
                key={type}
                onPress={() => setValue('type', type)}
                style={[styles.chip, { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg }]}
              >
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </Text>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={[styles.label, { color: t.fg }]}>Category</Text>
        <View style={styles.chipRow}>
          {(categories.data ?? []).map((cat) => {
            const active = watch('categoryId') === cat.id;
            return (
              <Text
                key={cat.id}
                onPress={() => setValue('categoryId', cat.id)}
                style={[styles.chip, { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg }]}
              >
                {cat.name}
              </Text>
            );
          })}
        </View>
        {errors.categoryId ? <Text style={{ color: t.danger, fontSize: 13 }}>{errors.categoryId.message}</Text> : null}
      </View>

      <Controller
        control={control}
        name="addressLine"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField label="Address" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.addressLine?.message} multiline />
        )}
      />
      <View style={styles.rowGap}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="city"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="City" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.city?.message} />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="state"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="State" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.state?.message} />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="pincode"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField label="Pincode" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.pincode?.message} keyboardType="numeric" maxLength={6} />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField label="Description" value={value ?? ''} onChangeText={onChange} onBlur={onBlur} error={errors.description?.message} multiline placeholder="What makes this space a good fit?" />
        )}
      />

      <View style={styles.rowGap}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="capacityValue"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="Capacity" value={value == null ? '' : String(value)} onChangeText={(v) => onChange(Number(v) || 0)} onBlur={onBlur} error={errors.capacityValue?.message} keyboardType="numeric" />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: t.fg }]}>Unit</Text>
          <View style={styles.chipRow}>
            {UNITS.map((unit) => {
              const active = watch('capacityUnit') === unit;
              return (
                <Text
                  key={unit}
                  onPress={() => setValue('capacityUnit', unit)}
                  style={[styles.chip, { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg }]}
                >
                  {unit}
                </Text>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.rowGap}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="basePrice"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="Base price (major units)" value={value == null ? '' : String(value)} onChangeText={(v) => onChange(Number(v) || 0)} onBlur={onBlur} error={errors.basePrice?.message} keyboardType="decimal-pad" placeholder="e.g. 2500" />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: t.fg }]}>Per</Text>
          <View style={styles.chipRow}>
            {PERIODS.map((p) => {
              const active = watch('pricingPeriod') === p;
              return (
                <Text
                  key={p}
                  onPress={() => setValue('pricingPeriod', p)}
                  style={[styles.chip, { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg }]}
                >
                  {p}
                </Text>
              );
            })}
          </View>
        </View>
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={{ color: t.fgStrong, fontWeight: '700' }}>Cover image</Text>
        {cover ? (
          <Image source={{ uri: cover.uri }} style={styles.preview} />
        ) : (
          <Text style={{ color: t.muted, fontSize: 13 }}>No cover image selected.</Text>
        )}
        <Button label={cover ? 'Change cover' : 'Add cover image'} variant="secondary" onPress={pickCover} />
      </Card>

      <Button label="Create listing" onPress={onSubmit} loading={isSubmitting} fullWidth />
    </Screen>
  );
}

/** Upload a local image by reading it as base64 and POSTing to /uploads. */
async function uploadViaUri(uri: string, mimetype: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const dataUri: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(blob);
  });
  const base64 = dataUri.split(',')[1] ?? '';
  const ext = mimetype.includes('png') ? 'png' : 'jpg';
  const uploaded = await uploadFile({
    buffer: base64,
    mimetype: mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
    originalname: `listing-${Date.now()}.${ext}`,
  });
  return uploaded.publicId;
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  errorBox: { padding: 12, borderRadius: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, overflow: 'hidden', fontSize: 13, fontWeight: '600' },
  rowGap: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  preview: { width: '100%', height: 160, borderRadius: 12 },
});
