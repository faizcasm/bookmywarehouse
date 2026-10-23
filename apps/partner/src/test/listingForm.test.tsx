import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListingForm } from '../components/ListingForm';
import { emptyListingValues, validateListingValues } from '../lib/listingForm';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn().mockResolvedValue({
        items: [
          { id: '6ad60a08fd0a88b533e7b6b4', name: 'General Warehousing', type: 'WAREHOUSE', isActive: true },
          { id: '6ad60a08fd0a88b533e7b6b7', name: 'Cold Storage', type: 'WAREHOUSE', isActive: true },
        ],
      }),
      post: vi.fn().mockResolvedValue({ id: 'x', slug: 'x', status: 'DRAFT' }),
    },
  };
});

function filledBase() {
  const values = emptyListingValues();
  values.title = 'Pune general warehouse with docks';
  values.description =
    'A spacious general warehouse in MIDC with four loading docks, 24x7 gate access and CCTV coverage across the yard.';
  values.categoryId = '6ad60a08fd0a88b533e7b6b4';
  values.location = {
    addressLine1: 'Warehouse 7, MIDC Phase II',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411019',
    country: 'India',
    region: '',
  };
  values.priceModel = 'PER_SQFT';
  values.priceAmount = '25';
  values.pricePeriod = 'MONTH';
  values.images = ['data:image/png;base64,iVBORw0KGgo='];
  values.cancellationDescription = 'Free cancellation up to 7 days before start.';
  return values;
}

describe('validateListingValues — type → required details mapping (createListingSchema)', () => {
  it('requires WAREHOUSE details for a WAREHOUSE listing', () => {
    const errors = validateListingValues('WAREHOUSE', filledBase());
    expect(errors.warehouse).toBe('Warehouse details are required');
    expect(errors.equipment).toBeUndefined();
    expect(errors.service).toBeUndefined();
  });

  it('requires EQUIPMENT details for an EQUIPMENT listing', () => {
    const errors = validateListingValues('EQUIPMENT', filledBase());
    expect(errors.equipment).toBe('Equipment details are required');
    expect(errors.warehouse).toBeUndefined();
  });

  it('requires SERVICE details for a SERVICE listing', () => {
    const errors = validateListingValues('SERVICE', filledBase());
    expect(errors.service).toBe('Service details are required');
    expect(errors.warehouse).toBeUndefined();
  });

  it('validates base fields regardless of type', () => {
    const values = filledBase();
    values.title = 'short';
    values.description = 'too short';
    values.priceAmount = '0';
    values.images = [];
    const errors = validateListingValues('WAREHOUSE', values);
    expect(errors.title).toBe('Title must be at least 8 characters');
    expect(errors.description).toBe('Description must be at least 40 characters');
    expect(errors.priceAmount).toBe('Price must be greater than zero');
    expect(errors.images).toBe('Add at least one image');
  });

  it('passes with a complete WAREHOUSE details block', () => {
    const values = filledBase();
    values.warehouse = {
      ...values.warehouse,
      facilityType: 'GENERAL',
      storageTypes: ['GENERAL'],
      totalCapacity: '5000',
      capacityUnit: 'SQFT',
      loadingDocks: '4',
    };
    const errors = validateListingValues('WAREHOUSE', values);
    expect(errors).toEqual({});
  });

  it('validates the EQUIPMENT details block (quantity required, year bounds)', () => {
    const values = filledBase();
    values.equipment = { ...values.equipment, equipmentCategory: 'FORKLIFT', quantity: '', manufactureYear: '1800' };
    const errors = validateListingValues('EQUIPMENT', values);
    expect(errors['equipment.quantity']).toBe('Quantity is required');
    expect(errors['equipment.manufactureYear']).toBe('Manufacture year must be at least 1950');
    expect(errors.equipment).toBeUndefined();
  });

  it('validates the SERVICE details block (service areas required)', () => {
    const values = filledBase();
    values.service = { ...values.service, serviceType: 'PACKAGING', serviceAreasText: '' };
    const errors = validateListingValues('SERVICE', values);
    expect(errors['service.serviceAreas']).toBe('Add at least one service area');
  });
});

describe('ListingForm — renders per type and blocks invalid submit', () => {
  it('shows warehouse fields and the block error when submitting empty WAREHOUSE form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ListingForm type="WAREHOUSE" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /create listing/i }));

    expect(await screen.findByText('Warehouse details are required')).toBeInTheDocument();
    expect(screen.getByLabelText(/facility type/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/equipment category/i)).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows equipment fields for EQUIPMENT type', async () => {
    render(<ListingForm type="EQUIPMENT" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/equipment category/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/facility type/i)).not.toBeInTheDocument();
  });

  it('submits a valid payload when the required details are filled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ListingForm type="WAREHOUSE" initial={filledBase()} onSubmit={onSubmit} />);

    // Warehouse details block (everything else comes pre-filled and valid)
    await user.selectOptions(screen.getByLabelText(/facility type/i), 'GENERAL');
    const storageGroup = screen.getByRole('group', { name: /storage types/i });
    await user.click(within(storageGroup).getAllByRole('checkbox')[0]!);
    await user.type(screen.getByLabelText(/total capacity/i), '5000');
    await user.selectOptions(screen.getByLabelText(/capacity unit/i), 'SQFT');
    await user.click(screen.getByRole('button', { name: /create listing/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]?.[0].payload as { type: string; price: { amount: number }; warehouse: { totalCapacity: number } };
    expect(payload.type).toBe('WAREHOUSE');
    expect(payload.price.amount).toBe(25);
    expect(payload.warehouse.totalCapacity).toBe(5000);
    // userEvent types character by character; on a loaded CI box this single
    // test legitimately needs >5s, which is the suite default.
  }, 20_000);
});
