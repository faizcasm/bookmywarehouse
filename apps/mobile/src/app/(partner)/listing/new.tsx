/**
 * New listing — guided form covering the create-listing contract.
 *
 * Saves as a draft via POST /partner/listings; publishing happens from the
 * listing detail screen once the basics look right.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ArrowLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import {
  Banner,
  Button,
  Card,
  Chip,
  Screen,
  SectionHeader,
  SignInPrompt,
  TextField,
} from '@/components/ui';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { createListing } from '@/services/api/partner';
import { getCategories } from '@/services/api/catalog';
import { uploadFile, uriToDataUri } from '@/services/api/uploads';
import { toCreateListingPayload } from '@/services/api/normalize';
import { ApiError } from '@/services/api/client';

const schema = z.object({
  title: z.string().trim().min(8, 'Title must be at least 8 characters').max(160),
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

const PERIODS = [
  { value: 'HOUR', label: 'Hourly' },
  { value: 'DAY', label: 'Daily' },
  { value: 'WEEK', label: 'Weekly' },
  { value: 'MONTH', label: 'Monthly' },
] as const;

const UNITS = [
  { value: 'SQFT', label: 'Sq ft' },
  { value: 'PALLET', label: 'Pallet' },
  { value: 'UNIT', label: 'Unit' },
  { value: 'TON', label: 'Ton' },
] as const;

const TYPES = [
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SERVICE', label: 'Service' },
] as const;

export default function NewListingScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();

  const [cover, setCover] = useState<{ uri: string; url?: string } | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'WAREHOUSE', pricingPeriod: 'DAY', capacityUnit: 'SQFT' },
  });

  const pickCover = async () => {
    if (coverBusy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setFormError('Allow photo access in Settings to add a cover image.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
      const asset = res.canceled ? null : res.assets[0];
      if (!asset) return;
      setCoverBusy(true);
      setFormError(null);
      setNotice(null);
      const dataUri = await uriToDataUri(asset.uri);
      const uploaded = await uploadFile({ file: dataUri, folder: 'listings' });
      setCover({ uri: asset.uri, url: uploaded.url });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not upload the image.');
    } finally {
      setCoverBusy(false);
    }
  };

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      createListing(
        toCreateListingPayload({
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
          coverImageUrl: cover?.url,
        }),
      ),
    onSuccess: () => {
      setFormError(null);
      setNotice('Listing created as a draft. Publish it from the listing page when you’re ready.');
      qc.invalidateQueries({ queryKey: ['partner-listings'] });
      qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
    },
    onError: (err) => {
      setNotice(null);
      if (err instanceof ApiError && err.issues.length) {
        setFormError(err.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
      } else {
        setFormError(err instanceof Error ? err.message : 'Could not create the listing.');
      }
    },
  });

  const onSubmit = handleSubmit((values) => create.mutate(values));

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to create a listing"
          subtitle="Listings are created and managed from your partner account."
          next="/(partner)/listing/new"
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
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(partner)/(tabs)/listings'))}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={t.fg} />
          <Text style={[styles.heading, { color: t.fgStrong }]}>New listing</Text>
        </Pressable>
      </View>

      {notice ? (
        <Banner
          tone="success"
          message={notice}
          actionLabel="Go to listings"
          onAction={() => router.replace('/(partner)/(tabs)/listings')}
        />
      ) : null}
      {formError ? <Banner tone="danger" message={formError} /> : null}

      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Title"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.title?.message}
            placeholder="e.g. 5,000 sqft warehouse with dock access"
            accessibilityLabel="Listing title"
            maxLength={160}
          />
        )}
      />

      <Controller
        control={control}
        name="type"
        render={({ field: { onChange, value } }) => (
          <View>
            <Text style={[styles.label, { color: t.fg }]}>Type</Text>
            <View style={styles.chipRow}>
              {TYPES.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={value === option.value}
                  onPress={() => onChange(option.value)}
                />
              ))}
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="categoryId"
        render={({ field: { onChange, value } }) => (
          <View>
            <Text style={[styles.label, { color: t.fg }]}>Category</Text>
            <View style={styles.chipRow}>
              {(categories.data ?? []).map((cat) => (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  selected={value === cat.id}
                  onPress={() => onChange(cat.id)}
                />
              ))}
            </View>
            {categories.isLoading ? (
              <Text style={{ color: t.faint, fontSize: 12.5 }}>Loading categories…</Text>
            ) : null}
            {categories.isError ? (
              <Text style={{ color: t.danger, fontSize: 13 }}>
                Could not load categories — pull this screen down or retry.
              </Text>
            ) : null}
            {errors.categoryId ? (
              <Text style={{ color: t.danger, fontSize: 13 }}>{errors.categoryId.message}</Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="addressLine"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Address"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.addressLine?.message}
            multiline
            accessibilityLabel="Listing address"
          />
        )}
      />
      <View style={styles.rowGap}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="city"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="City"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.city?.message}
                accessibilityLabel="City"
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="state"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="State"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.state?.message}
                accessibilityLabel="State"
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="pincode"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Pincode"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.pincode?.message}
            keyboardType="numeric"
            maxLength={6}
            accessibilityLabel="Pincode"
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Description"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.description?.message}
            multiline
            placeholder="What makes this space a good fit?"
            accessibilityLabel="Listing description"
            maxLength={2000}
          />
        )}
      />

      <SectionHeader title="Capacity & pricing" />
      <View style={styles.rowGap}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="capacityValue"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Capacity"
                value={value == null ? '' : String(value)}
                onChangeText={(v) => onChange(Number(v) || 0)}
                onBlur={onBlur}
                error={errors.capacityValue?.message}
                keyboardType="numeric"
                accessibilityLabel="Capacity"
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="capacityUnit"
            render={({ field: { onChange, value } }) => (
              <View>
                <Text style={[styles.label, { color: t.fg }]}>Unit</Text>
                <View style={styles.chipRow}>
                  {UNITS.map((unit) => (
                    <Chip
                      key={unit.value}
                      size="sm"
                      label={unit.label}
                      selected={value === unit.value}
                      onPress={() => onChange(unit.value)}
                    />
                  ))}
                </View>
              </View>
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="basePrice"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Base price (₹, major units)"
            value={value == null ? '' : String(value)}
            onChangeText={(v) => onChange(Number(v) || 0)}
            onBlur={onBlur}
            error={errors.basePrice?.message}
            keyboardType="decimal-pad"
            placeholder="e.g. 2500"
            accessibilityLabel="Base price in rupees"
          />
        )}
      />
      <Controller
        control={control}
        name="pricingPeriod"
        render={({ field: { onChange, value } }) => (
          <View>
            <Text style={[styles.label, { color: t.fg }]}>Charged per</Text>
            <View style={styles.chipRow}>
              {PERIODS.map((period) => (
                <Chip
                  key={period.value}
                  label={period.label}
                  selected={value === period.value}
                  onPress={() => onChange(period.value)}
                />
              ))}
            </View>
          </View>
        )}
      />

      <SectionHeader title="Cover image" />
      <Card style={{ gap: 10 }}>
        {cover ? (
          <Image
            source={{ uri: cover.uri }}
            style={[styles.preview, { backgroundColor: t.surface3 }]}
            contentFit="cover"
            accessibilityLabel="Selected cover image"
          />
        ) : (
          <Text style={{ color: t.muted, fontSize: 13 }}>
            A cover image is required — listings without photos can’t be published.
          </Text>
        )}
        <Button
          label={coverBusy ? 'Uploading…' : cover ? 'Change cover' : 'Add cover image'}
          variant="secondary"
          loading={coverBusy}
          disabled={coverBusy || isSubmitting}
          onPress={() => void pickCover()}
        />
      </Card>

      <Button
        label={isSubmitting ? 'Creating…' : 'Create listing'}
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={coverBusy || !cover?.url}
        fullWidth
      />
      {!cover?.url ? (
        <Text style={{ color: t.faint, fontSize: 12.5 }}>
          Add a cover image to enable creation.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backBar: { marginBottom: 2 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  heading: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  rowGap: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  preview: { width: '100%', height: 160, borderRadius: 12 },
});
