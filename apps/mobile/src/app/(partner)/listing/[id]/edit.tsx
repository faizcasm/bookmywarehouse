/**
 * Partner listing edit — title, description, photos, pricing and capacity.
 *
 * The PATCH payload is assembled field-by-field (see updateListingSchema in
 * packages/validation): only changed fields are sent, so editing a title can't
 * silently reset cancellation terms / amenities, and description or price edits
 * re-trigger moderation only when they were actually touched.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ArrowLeft, ImagePlus, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';

import {
  Banner,
  Button,
  ErrorState,
  Screen,
  SectionHeader,
  SignInPrompt,
  Skeleton,
  TextField,
} from '@/components/ui';
import { ApiError } from '@/services/api/client';
import { getPartnerListing, updateListing } from '@/services/api/partner';
import { uploadFile, uriToDataUri } from '@/services/api/uploads';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { periodWord } from '@/utils/format';

const PERIODS = ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_LABELS: Record<Period, string> = {
  HOUR: 'Hourly',
  DAY: 'Daily',
  WEEK: 'Weekly',
  MONTH: 'Monthly',
  YEAR: 'Yearly',
};

const MAX_IMAGES = 8;

const editSchema = z.object({
  title: z.string().trim().min(8, 'Title must be at least 8 characters').max(160),
  description: z
    .string()
    .trim()
    .min(40, 'Description must be at least 40 characters')
    .max(5000),
  priceMajor: z
    .number({ message: 'Enter a valid price' })
    .positive('Price must be greater than zero')
    .max(1_000_000_000, 'Price looks too large'),
  period: z.enum(PERIODS),
  warehouseCapacity: z
    .number({ message: 'Enter a valid capacity' })
    .positive('Capacity must be greater than zero')
    .max(10_000_000, 'Capacity looks too large')
    .optional(),
  dailyCapacity: z
    .number({ message: 'Enter a valid daily capacity' })
    .int('Daily capacity must be a whole number')
    .positive('Daily capacity must be greater than zero')
    .max(100_000, 'Daily capacity looks too large')
    .optional(),
  equipmentQuantity: z
    .number({ message: 'Enter a valid quantity' })
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than zero')
    .max(100_000, 'Quantity looks too large')
    .optional(),
  addressLine1: z.string().trim().min(3, 'Address must be at least 3 characters').max(200),
  city: z.string().trim().min(2, 'Enter a city').max(80),
  stateName: z.string().trim().min(2, 'Enter a state').max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z -]{4,12}$/, 'Enter a valid PIN code'),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof editSchema>, string>>;

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Try again.';

/** Spec helpers — `specifications` holds the type-specific block's scalars. */
function specString(specs: Record<string, string | number | boolean>, key: string): string | null {
  const value = specs[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function specNumber(specs: Record<string, string | number | boolean>, key: string): number | null {
  const value = specs[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function specBool(specs: Record<string, string | number | boolean>, key: string): boolean {
  return specs[key] === true;
}

/** Arrays are flattened to `"a, b"` by buildSpecifications — split them back. */
function specList(specs: Record<string, string | number | boolean>, key: string): string[] {
  const value = specString(specs, key);
  return value ? value.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

/**
 * The API's PATCH replaces the whole price object, so every field we can't
 * see from the mobile view-model keeps its schema default. The model survives
 * on `priceModel`; when it's missing we derive it from the period like the
 * create flow does.
 */
function modelFor(priceModel: string | undefined, period: Period): string {
  const valid = ['FIXED', 'PER_SQFT', 'PER_SQMT', 'PER_PALLET', 'PER_UNIT', 'PER_HOUR', 'PER_DAY'];
  if (priceModel && valid.includes(priceModel)) return priceModel;
  if (period === 'HOUR') return 'PER_HOUR';
  if (period === 'DAY') return 'PER_DAY';
  return 'FIXED';
}

function isPeriod(value: string): value is Period {
  return (PERIODS as readonly string[]).includes(value);
}

interface FormProps {
  listingId: string;
  initial: NonNullable<Awaited<ReturnType<typeof getPartnerListing>>>;
}

function EditForm({ listingId, initial }: FormProps) {
  const t = useTheme();
  const qc = useQueryClient();

  const specs = initial.specifications ?? {};
  const initialImages = [
    ...(initial.coverUrl ? [initial.coverUrl] : []),
    ...(initial.gallery ?? []).filter((url) => url !== initial.coverUrl),
  ].slice(0, MAX_IMAGES);
  const initialPeriod: Period = isPeriod(initial.pricingPeriod) ? initial.pricingPeriod : 'MONTH';

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const [price, setPrice] = useState(String(initial.priceMinor / 100));
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [images, setImages] = useState<string[]>(initialImages);
  const [capacity, setCapacity] = useState(
    initial.capacityValue === null || initial.capacityValue === undefined
      ? ''
      : String(initial.capacityValue),
  );
  const [addressLine1, setAddressLine1] = useState(initial.addressLine ?? '');
  const [city, setCity] = useState(initial.city ?? '');
  const [stateName, setStateName] = useState(initial.state ?? '');
  const [postalCode, setPostalCode] = useState(initial.postalCode ?? '');
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status = initial.status ?? 'DRAFT';

  // Warehouse capacity can only be rebuilt when the enum fields the PATCH
  // requires are present in the flattened specs.
  const warehouseEditable =
    initial.type === 'WAREHOUSE' &&
    Boolean(specString(specs, 'facilityType')) &&
    specList(specs, 'storageTypes').length > 0 &&
    Boolean(specString(specs, 'capacityUnit'));
  const serviceEditable =
    initial.type === 'SERVICE' &&
    Boolean(specString(specs, 'serviceType')) &&
    specList(specs, 'serviceAreas').length > 0;
  const equipmentEditable = initial.type === 'EQUIPMENT' && Boolean(initial.equipment?.equipmentCategory);

  const priceMajor = Number(price.replace(',', '.'));
  const capacityNumber = capacity.trim() === '' ? undefined : Number(capacity.replace(',', '.'));

  const validate = (): FieldErrors => {
    const result = editSchema.safeParse({
      title,
      description,
      priceMajor,
      period,
      warehouseCapacity: warehouseEditable ? capacityNumber : undefined,
      dailyCapacity: serviceEditable ? capacityNumber : undefined,
      equipmentQuantity: equipmentEditable ? capacityNumber : undefined,
      addressLine1,
      city,
      stateName,
      postalCode,
    });
    if (result.success) return {};
    const next: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof FieldErrors;
      if (!next[key]) next[key] = issue.message;
    }
    return next;
  };

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => updateListing(listingId, patch),
    onSuccess: (_result, patch) => {
      setFormError(null);
      const triggersReview =
        status === 'PUBLISHED' && ('description' in patch || 'price' in patch);
      setNotice(
        triggersReview
          ? 'Changes saved. Your listing goes back into review before it reappears in search.'
          : 'Changes saved.',
      );
      qc.invalidateQueries({ queryKey: ['partner-listing', listingId] });
      qc.invalidateQueries({ queryKey: ['partner-listings'] });
      qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
    },
    onError: (e) => {
      setNotice(null);
      if (e instanceof ApiError && e.issues.length) {
        setFormError(e.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
      } else {
        setFormError(errorText(e));
      }
    },
  });

  const pickImage = async () => {
    if (uploading || images.length >= MAX_IMAGES) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setFormError('Allow photo access in Settings to add photos to this listing.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      setUploading(true);
      setFormError(null);
      const uploaded = await uploadFile({ file: await uriToDataUri(asset.uri), folder: 'listings' });
      setImages((current) => [...current, uploaded.url].slice(0, MAX_IMAGES));
      setNotice(null);
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((current) => current.filter((_, i) => i !== index));
    setNotice(null);
  };

  const onSubmit = () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    if (images.length === 0) {
      setFormError('Keep at least one photo on the listing.');
      return;
    }

    const patch: Record<string, unknown> = {};
    const trimmedTitle = title.trim();
    if (trimmedTitle !== initial.title) patch.title = trimmedTitle;

    const trimmedDescription = description.trim();
    if (trimmedDescription !== (initial.description ?? '')) patch.description = trimmedDescription;

    const priceMinor = Math.round(priceMajor * 100);
    if (priceMinor !== initial.priceMinor || period !== initialPeriod) {
      patch.price = {
        model: modelFor(initial.priceModel, period),
        amount: priceMajor,
        currency: initial.currency,
        period,
        unitLabel: `per ${periodWord(period)}`,
      };
    }

    if (images.join('|') !== initialImages.join('|')) patch.images = images;

    if (warehouseEditable && capacityNumber !== undefined && capacityNumber !== initial.capacityValue) {
      patch.warehouse = {
        facilityType: specString(specs, 'facilityType'),
        storageTypes: specList(specs, 'storageTypes'),
        totalCapacity: capacityNumber,
        capacityUnit: specString(specs, 'capacityUnit'),
        numberOfUnits: specNumber(specs, 'numberOfUnits'),
        unitDimensions: specString(specs, 'unitDimensions'),
        ceilingHeightM: specNumber(specs, 'ceilingHeightM'),
        floorLoadCapacityKg: specNumber(specs, 'floorLoadCapacityKg'),
        loadingDocks: specNumber(specs, 'loadingDocks') ?? 0,
        driveways: specNumber(specs, 'driveways') ?? 0,
        temperatureControlled: specBool(specs, 'temperatureControlled'),
        humidityControlled: specBool(specs, 'humidityControlled'),
        powerBackup: specBool(specs, 'powerBackup'),
        fireSafety: specBool(specs, 'fireSafety'),
        cctv: specBool(specs, 'cctv'),
        certifications: specList(specs, 'certifications'),
        operatingHours: specString(specs, 'operatingHours'),
      };
    }

    if (serviceEditable && capacityNumber !== undefined && capacityNumber !== initial.capacityValue) {
      patch.service = {
        serviceType: specString(specs, 'serviceType'),
        serviceAreas: specList(specs, 'serviceAreas'),
        estimatedDurationHours: specNumber(specs, 'estimatedDurationHours'),
        teamSize: specNumber(specs, 'teamSize'),
        dailyCapacity: capacityNumber,
        requirements: specString(specs, 'requirements'),
      };
    }

    if (equipmentEditable && capacityNumber !== undefined && capacityNumber !== initial.capacityValue) {
      const equipment = initial.equipment ?? {};
      patch.equipment = {
        equipmentCategory: equipment.equipmentCategory,
        brand: equipment.brand ?? null,
        model: equipment.model ?? null,
        manufactureYear: equipment.manufactureYear ?? null,
        quantity: capacityNumber,
        rentalPeriod: equipment.rentalPeriod,
        deliveryAvailable: equipment.deliveryAvailable ?? false,
        operatorAvailable: equipment.operatorAvailable ?? false,
        // Round-trip untouched (the API stores/returns the same unit).
        operatorChargePerDay: equipment.operatorChargePerDay ?? null,
        minRentalDuration: equipment.minRentalDuration ?? null,
        specifications: equipment.specifications ?? {},
      };
    }

    // The PATCH replaces `location` wholesale, so preserve the coordinates.
    const nextAddress = addressLine1.trim();
    const nextCity = city.trim();
    const nextState = stateName.trim();
    const nextPin = postalCode.trim();
    if (
      nextAddress !== (initial.addressLine ?? '') ||
      nextCity !== (initial.city ?? '') ||
      nextState !== (initial.state ?? '') ||
      nextPin !== (initial.postalCode ?? '')
    ) {
      patch.location = {
        addressLine1: nextAddress,
        city: nextCity,
        state: nextState,
        postalCode: nextPin,
        country: 'India',
        ...(initial.latitude != null && initial.longitude != null
          ? { coordinates: { lat: initial.latitude, lng: initial.longitude } }
          : {}),
      };
    }

    if (Object.keys(patch).length === 0) {
      setFormError(null);
      setNotice('No changes to save.');
      return;
    }
    save.mutate(patch);
  };

  const showCapacityField = warehouseEditable || serviceEditable || equipmentEditable;
  const capacityLabel =
    initial.type === 'WAREHOUSE'
      ? `Total capacity (${(initial.capacityUnit ?? '').toLowerCase() || 'units'})`
      : initial.type === 'SERVICE'
        ? 'Daily capacity (jobs per day)'
        : 'Units available for hire';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.backBar}>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(partner)/(tabs)/listings'))}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={t.fg} />
          <Text style={[styles.backTitle, { color: t.fgStrong }]}>Edit listing</Text>
        </Pressable>
      </View>

      {notice ? (
        <Banner tone="success" message={notice} actionLabel="Dismiss" onAction={() => setNotice(null)} />
      ) : null}
      {formError ? <Banner tone="danger" message={formError} /> : null}

      <SectionHeader title={`Photos (${images.length}/${MAX_IMAGES})`} />
      <View style={styles.photoRow} accessibilityRole="list">
        {images.map((uri, index) => (
          <View
            key={`${uri}-${index}`}
            style={[styles.photoTile, { backgroundColor: t.surface3 }]}
            accessibilityRole="listitem"
          >
            <Image source={{ uri }} style={styles.photo} contentFit="cover" transition={150} />
            <Pressable
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              onPress={() => removeImage(index)}
              style={[styles.removePhoto, { backgroundColor: 'rgba(2,6,23,0.6)' }]}
            >
              <X size={14} color="#ffffff" />
            </Pressable>
          </View>
        ))}
        {images.length < MAX_IMAGES ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            disabled={uploading}
            onPress={() => void pickImage()}
            style={[styles.addPhoto, { borderColor: t.lineStrong, opacity: uploading ? 0.6 : 1 }]}
          >
            {uploading ? (
              <ActivityIndicator color={t.brand} />
            ) : (
              <>
                <ImagePlus size={22} color={t.brand} />
                <Text style={[styles.addPhotoLabel, { color: t.muted }]}>Add</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        error={errors.title}
        placeholder="e.g. 5,000 sqft warehouse with dock access"
        accessibilityLabel="Listing title"
        maxLength={160}
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        error={errors.description}
        placeholder="What makes this space a good fit? Access hours, dock levelers, security…"
        accessibilityLabel="Listing description"
        multiline
        maxLength={5000}
      />

      <SectionHeader title="Pricing" />
      <TextField
        label={`Price per ${periodWord(period) || 'period'} (${initial.currency}, major units)`}
        value={price}
        onChangeText={setPrice}
        error={errors.priceMajor}
        keyboardType="decimal-pad"
        accessibilityLabel={`Price in ${initial.currency}`}
      />
      <Text style={[styles.chipLabel, { color: t.fg }]}>Billing period</Text>
      <View style={styles.chipRow}>
        {PERIODS.map((option) => (
          <Text
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: period === option }}
            onPress={() => {
              setPeriod(option);
              setNotice(null);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: period === option ? t.brandSoft : t.surface,
                borderColor: period === option ? t.brand : t.line,
                color: period === option ? t.brandSoftFg : t.fg,
              },
            ]}
          >
            {PERIOD_LABELS[option]}
          </Text>
        ))}
      </View>

      {showCapacityField ? (
        <>
          <SectionHeader title={initial.type === 'EQUIPMENT' ? 'Quantity' : 'Capacity'} />
          <TextField
            label={capacityLabel}
            value={capacity}
            onChangeText={setCapacity}
            error={errors.warehouseCapacity ?? errors.dailyCapacity ?? errors.equipmentQuantity}
            keyboardType="numeric"
            accessibilityLabel={capacityLabel}
            hint={
              initial.type === 'EQUIPMENT'
                ? 'How many units of this equipment are available to hire.'
                : undefined
            }
          />
        </>
      ) : null}

      <SectionHeader title="Address" />
      <TextField
        label="Address line"
        value={addressLine1}
        onChangeText={setAddressLine1}
        error={errors.addressLine1}
        placeholder="Building, street, area"
        accessibilityLabel="Address line"
        maxLength={200}
      />
      <View style={styles.splitRow}>
        <View style={styles.splitCell}>
          <TextField
            label="City"
            value={city}
            onChangeText={setCity}
            error={errors.city}
            accessibilityLabel="City"
            maxLength={80}
          />
        </View>
        <View style={styles.splitCell}>
          <TextField
            label="State"
            value={stateName}
            onChangeText={setStateName}
            error={errors.stateName}
            accessibilityLabel="State"
            maxLength={80}
          />
        </View>
      </View>
      <TextField
        label="PIN code"
        value={postalCode}
        onChangeText={setPostalCode}
        error={errors.postalCode}
        keyboardType="numeric"
        accessibilityLabel="PIN code"
        maxLength={12}
      />
      <Text style={[styles.note, { color: t.faint }]}>
        Category: {initial.categoryName ?? 'Uncategorised'}. Category changes are handled by the
        BookMyWarehouse team.
      </Text>

      {status === 'PUBLISHED' &&
      (description.trim() !== (initial.description ?? '') ||
        Math.round(priceMajor * 100) !== initial.priceMinor ||
        period !== initialPeriod) ? (
        <Text style={[styles.note, { color: t.warningSoftFg }]}>
          Editing the price or description of a published listing sends it back into review.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={save.isPending ? 'Saving…' : 'Save changes'}
          onPress={onSubmit}
          loading={save.isPending}
          disabled={save.isPending || uploading}
          fullWidth
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(partner)/(tabs)/listings'))}
          fullWidth
        />
      </View>
    </KeyboardAvoidingView>
  );
}

export default function PartnerListingEditScreen() {
  const t = useTheme();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = id ?? '';

  const listing = useQuery({
    queryKey: ['partner-listing', listingId],
    queryFn: () => getPartnerListing(listingId),
    enabled: Boolean(listingId) && Boolean(user),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to edit this listing"
          subtitle="Listing editing is available from your partner account."
          next={`/(partner)/listing/${listingId}/edit`}
        />
      </Screen>
    );
  }

  if (listing.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={40} radius={12} />
        <Skeleton height={120} radius={t.radiusLg} />
        <Skeleton height={48} radius={12} />
        <Skeleton height={48} radius={12} />
        <Skeleton height={160} radius={t.radiusLg} />
      </Screen>
    );
  }

  if (listing.isError || !listing.data) {
    const notFound = listing.error instanceof ApiError && listing.error.status === 404;
    return (
      <Screen>
        <ErrorState
          title={notFound ? 'Listing not found' : undefined}
          error={listing.error}
          onRetry={notFound ? undefined : () => listing.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <EditForm key={listingId} listingId={listingId} initial={listing.data} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backBar: { marginBottom: 4 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  backTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  photoTile: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  chipLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  splitRow: { flexDirection: 'row', gap: 10 },
  splitCell: { flex: 1 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
  },
  note: { fontSize: 13, lineHeight: 19 },
  actions: { gap: 10, marginTop: 12 },
});
