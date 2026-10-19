/**
 * OpenAPI 3.0 specification for the BookMyWarehouse API (apps/api).
 *
 * Hand-written on purpose — no generator tooling, no new dependencies. The
 * exported object is served as JSON at `GET /api/v1/openapi.json` and rendered
 * by Swagger UI at `GET /api/v1/docs` (wired in app.ts).
 *
 * Source of truth: apps/api/src/routes/*.ts + controllers, cross-checked with
 * docs/API_REFERENCE.md (which documents the same contract for the frontends).
 *
 * Conventions encoded here:
 *  - Success envelope: `{ success: true, data, meta?, requestId }`
 *  - Error envelope:   `{ success: false, error: { code, message, issues? }, requestId }`
 *  - Monetary amounts are integer minor units (paise) unless noted otherwise.
 *  - Auth: `Authorization: Bearer <accessToken>` (preferred) or the httpOnly
 *    refresh cookie `bmw_rt` plus the readable `bmw_csrf` cookie echoed in the
 *    `X-CSRF-Token` header on every non-GET request.
 */

type Json = Record<string, unknown>;

interface Operation {
  tags: string[];
  summary: string;
  description?: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Json[];
  requestBody?: Json;
  /** Keys are HTTP status codes as strings; values are response objects. */
  responses: Json;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
}

type PathMap = Record<string, PathItem>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** A 2xx JSON response wrapped in the success envelope. */
function ok(description: string, dataSchema?: Json): Json {
  const schema: Json = dataSchema
    ? {
        allOf: [
          { $ref: '#/components/schemas/SuccessEnvelope' },
          { type: 'object', properties: { data: dataSchema } },
        ],
      }
    : { $ref: '#/components/schemas/SuccessEnvelope' };
  return { description, content: { 'application/json': { schema } } };
}

const ERROR_REFS: Record<string, Json> = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '401': { $ref: '#/components/responses/Unauthenticated' },
  '403': { $ref: '#/components/responses/Forbidden' },
  '404': { $ref: '#/components/responses/NotFound' },
  '409': { $ref: '#/components/responses/Conflict' },
  '412': { $ref: '#/components/responses/PreconditionFailed' },
  '422': { $ref: '#/components/responses/ValidationFailed' },
  '429': { $ref: '#/components/responses/RateLimited' },
};

/** Spread into an operation's `responses` to attach standard error responses. */
function errs(...codes: string[]): Json {
  const out: Json = {};
  for (const code of codes) {
    const ref = ERROR_REFS[code];
    if (ref) out[code] = ref;
  }
  return out;
}

/* Common response sets ------------------------------------------------ */

function publicRead(): Json {
  return errs('400', '404');
}
function publicValidated(): Json {
  return errs('400', '404', '422');
}
function authRead(): Json {
  return errs('400', '401', '403', '404');
}
function authReadValidated(): Json {
  return errs('400', '401', '403', '404', '422');
}
function authWrite(): Json {
  return errs('400', '401', '403', '404', '422');
}
function authConflictWrite(): Json {
  return errs('400', '401', '403', '404', '409', '422');
}
function publicWrite(): Json {
  return errs('400', '422');
}
function rateLimitedWrite(): Json {
  return errs('400', '422', '429');
}

/** Request body (application/json). */
function jsonBody(schema: Json, description?: string, required = true): Json {
  return {
    required,
    ...(description ? { description } : {}),
    content: { 'application/json': { schema } },
  };
}

function pathParam(name: string, description: string): Json {
  return { name, in: 'path', required: true, description, schema: { type: 'string' } };
}

function queryParam(name: string, description: string, schema: Json): Json {
  return { name, in: 'query', required: false, description, schema };
}

const pageParam: Json = queryParam('page', 'Page number (1-based).', {
  type: 'integer',
  minimum: 1,
  default: 1,
});

function limitParam(def = 12, max = 100): Json {
  return queryParam('limit', `Page size (max ${max}).`, {
    type: 'integer',
    minimum: 1,
    maximum: max,
    default: def,
  });
}

const qParam: Json = queryParam('q', 'Free-text search / filter term.', {
  type: 'string',
  maxLength: 120,
});

/** Standard `status` filter used by console list endpoints. */
function statusParam(description: string, maxLength = 60): Json {
  return queryParam('status', description, { type: 'string', maxLength });
}

/**
 * Authentication requirements.
 *  - Preferred: bearer access token (`Authorization: Bearer <accessToken>`).
 *  - Browser flow: httpOnly `bmw_rt` refresh cookie + `X-CSRF-Token` header
 *    echoing the readable `bmw_csrf` cookie (non-GET requests only).
 */
const AUTH_SECURITY: Array<Record<string, string[]>> = [
  { bearerAuth: [] },
  { cookieAuth: [], csrfToken: [] },
];

const PARTNER_NOTE = 'Requires role `PARTNER` or `ADMIN`.';
const ADMIN_NOTE = 'Requires role `ADMIN`.';
const SCOPED_BOOKINGS_NOTE =
  'Visibility is role-scoped: customers see their own bookings, partners see bookings for their listings, admins see everything (plus `scope=admin`).';

/* ------------------------------------------------------------------ */
/* Reusable request-body fragments                                     */
/* ------------------------------------------------------------------ */

const locationBody: Json = {
  type: 'object',
  required: ['addressLine1', 'city', 'state', 'postalCode'],
  properties: {
    addressLine1: { type: 'string', minLength: 3, maxLength: 200 },
    addressLine2: { type: 'string', maxLength: 200 },
    landmark: { type: 'string', maxLength: 200 },
    city: { type: 'string', minLength: 2, maxLength: 80 },
    state: { type: 'string', minLength: 2, maxLength: 80 },
    postalCode: { type: 'string', pattern: '^[0-9A-Za-z -]{4,12}$' },
    country: { type: 'string', default: 'India' },
    region: { type: 'string', maxLength: 120 },
    coordinates: {
      type: 'object',
      properties: { lat: { type: 'number' }, lng: { type: 'number' } },
    },
    serviceRadiusKm: { type: 'number' },
  },
};

const listingPriceBody: Json = {
  type: 'object',
  required: ['model', 'amount'],
  properties: {
    model: {
      type: 'string',
      enum: ['FIXED', 'PER_SQFT', 'PER_SQMT', 'PER_PALLET', 'PER_UNIT', 'PER_HOUR', 'PER_DAY'],
    },
    amount: {
      type: 'number',
      exclusiveMinimum: true,
      minimum: 0,
      description: 'Price in MAJOR units (e.g. 1250.50 INR); persisted as minor units server-side.',
    },
    currency: { type: 'string', minLength: 3, maxLength: 3, default: 'INR' },
    period: { type: 'string', enum: ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'] },
    unitLabel: { type: 'string', maxLength: 80 },
    minQuantity: { type: 'integer' },
    additionalCharges: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        required: ['label', 'amount'],
        properties: {
          label: { type: 'string', maxLength: 80 },
          amount: { type: 'number' },
          taxable: { type: 'boolean', default: true },
        },
      },
    },
  },
};

const cancellationTermsBody: Json = {
  type: 'object',
  required: ['description', 'customerRefundPercent'],
  properties: {
    policy: { type: 'string', enum: ['FLEXIBLE', 'MODERATE', 'STRICT', 'CUSTOM'], default: 'MODERATE' },
    description: { type: 'string', minLength: 5, maxLength: 600 },
    customerRefundPercent: { type: 'integer', minimum: 0, maximum: 100 },
    note: { type: 'string', maxLength: 400 },
  },
};

const quoteBody: Json = {
  type: 'object',
  required: ['listingId', 'startDate'],
  properties: {
    listingId: { type: 'string', description: 'Listing ObjectId.' },
    startDate: { type: 'string', format: 'date', description: 'ISO date; cannot be in the past.' },
    endDate: { type: 'string', format: 'date', description: 'Must be after startDate.' },
    capacity: { type: 'number', description: 'Requested capacity, in the listing capacity unit.' },
    quantity: { type: 'integer', minimum: 1, default: 1 },
    deliveryRequired: { type: 'boolean', default: false },
    operatorRequired: { type: 'boolean', default: false },
  },
};

const createBookingBody: Json = {
  type: 'object',
  required: ['listingId', 'startDate'],
  properties: {
    ...(quoteBody['properties'] as Json),
    notes: { type: 'string', maxLength: 1000 },
    specialRequirements: { type: 'string', maxLength: 2000 },
  },
};

const listingCreateBody: Json = {
  type: 'object',
  required: ['type', 'title', 'description', 'categoryId', 'location', 'price', 'images'],
  properties: {
    type: { type: 'string', enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] },
    slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', description: 'Optional custom slug.' },
    title: { type: 'string', minLength: 8, maxLength: 160 },
    description: { type: 'string', minLength: 40, maxLength: 5000 },
    categoryId: { type: 'string', description: 'Category ObjectId.' },
    location: locationBody,
    price: listingPriceBody,
    images: {
      type: 'array',
      minItems: 1,
      maxItems: 15,
      items: { type: 'string', description: 'https URL or data:image URI.' },
    },
    amenities: { type: 'array', maxItems: 40, items: { type: 'string', maxLength: 60 } },
    safetyFeatures: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 60 } },
    rules: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 300 } },
    minBookingDuration: {
      type: 'object',
      properties: {
        value: { type: 'integer', minimum: 1 },
        unit: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] },
      },
    },
    cancellationTerms: cancellationTermsBody,
    availableFrom: { type: 'string', format: 'date' },
    warehouse: {
      type: 'object',
      description: 'Required when `type=WAREHOUSE`.',
      properties: {
        facilityType: {
          type: 'string',
          enum: [
            'GENERAL',
            'INDUSTRIAL',
            'COMMERCIAL',
            'DISTRIBUTION',
            'COLD_STORAGE',
            'FULFILLMENT',
            'SHORT_TERM',
            'LONG_TERM',
            'OTHER',
          ],
        },
        storageTypes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'string',
            enum: ['GENERAL', 'COLD', 'FROZEN', 'HAZARDOUS', 'BONDED', 'AGRICULTURE', 'PHARMACEUTICAL', 'OTHER'],
          },
        },
        totalCapacity: { type: 'number' },
        capacityUnit: {
          type: 'string',
          enum: ['SQFT', 'SQM', 'PALLET', 'TON', 'CBM', 'UNIT', 'LITRE'],
        },
        numberOfUnits: { type: 'integer' },
        unitDimensions: { type: 'string', maxLength: 200 },
        ceilingHeightM: { type: 'number' },
        floorLoadCapacityKg: { type: 'number' },
        loadingDocks: { type: 'integer', default: 0 },
        driveways: { type: 'integer', default: 0 },
        temperatureControlled: { type: 'boolean', default: false },
        humidityControlled: { type: 'boolean', default: false },
        powerBackup: { type: 'boolean', default: false },
        fireSafety: { type: 'boolean', default: false },
        cctv: { type: 'boolean', default: false },
        certifications: { type: 'array', items: { type: 'string' } },
        operatingHours: { type: 'string' },
      },
    },
    equipment: {
      type: 'object',
      description: 'Required when `type=EQUIPMENT`.',
      properties: {
        equipmentCategory: {
          type: 'string',
          enum: ['FORKLIFT', 'CRANE', 'PALLET_TRUCK', 'MATERIAL_HANDLING', 'LOADING', 'GENERATOR', 'OTHER'],
        },
        brand: { type: 'string' },
        model: { type: 'string' },
        manufactureYear: { type: 'integer' },
        quantity: { type: 'integer', minimum: 1 },
        rentalPeriod: { type: 'string', enum: ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'], default: 'DAY' },
        deliveryAvailable: { type: 'boolean', default: false },
        operatorAvailable: { type: 'boolean', default: false },
        operatorChargePerDay: { type: 'number' },
        minRentalDuration: { type: 'integer' },
        specifications: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    service: {
      type: 'object',
      description: 'Required when `type=SERVICE`.',
      properties: {
        serviceType: {
          type: 'string',
          enum: [
            'LOADING_UNLOADING',
            'PACKAGING',
            'TRANSPORTATION',
            'MATERIAL_HANDLING',
            'INVENTORY_MANAGEMENT',
            'CONSULTING',
            'OTHER',
          ],
        },
        serviceAreas: { type: 'array', minItems: 1, items: { type: 'string' } },
        estimatedDurationHours: { type: 'number' },
        teamSize: { type: 'integer' },
        dailyCapacity: { type: 'integer' },
        requirements: { type: 'string', maxLength: 600 },
      },
    },
  },
};

const listingUpdateBody: Json = {
  type: 'object',
  description: 'All fields optional (partial update). Send `clearWarehouse` / `clearEquipment` / `clearService` = true to remove a type-specific block.',
  properties: {
    title: { type: 'string', minLength: 8, maxLength: 160 },
    description: { type: 'string', minLength: 40, maxLength: 5000 },
    categoryId: { type: 'string' },
    location: locationBody,
    price: listingPriceBody,
    images: {
      type: 'array',
      minItems: 1,
      maxItems: 15,
      items: { type: 'string' },
    },
    amenities: { type: 'array', maxItems: 40, items: { type: 'string' } },
    safetyFeatures: { type: 'array', maxItems: 30, items: { type: 'string' } },
    rules: { type: 'array', maxItems: 30, items: { type: 'string' } },
    minBookingDuration: {
      type: 'object',
      properties: {
        value: { type: 'integer', minimum: 1 },
        unit: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] },
      },
    },
    cancellationTerms: cancellationTermsBody,
    availableFrom: { type: 'string', format: 'date' },
    warehouse: { type: 'object', additionalProperties: true },
    equipment: { type: 'object', additionalProperties: true },
    service: { type: 'object', additionalProperties: true },
    clearWarehouse: { type: 'boolean' },
    clearEquipment: { type: 'boolean' },
    clearService: { type: 'boolean' },
  },
};

/* ------------------------------------------------------------------ */
/* Component schemas (responses)                                       */
/* ------------------------------------------------------------------ */

const componentSchemas: Json = {
  SuccessEnvelope: {
    type: 'object',
    description: 'Standard success envelope returned by every endpoint except the payment webhook.',
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: { description: 'Endpoint-specific payload (documented per operation).' },
      meta: {
        type: 'object',
        description: 'Present on list endpoints.',
        properties: { pagination: { $ref: '#/components/schemas/PaginationMeta' } },
      },
      requestId: { type: 'string', description: 'Correlation id, also returned as the X-Request-Id header.' },
    },
  },
  ErrorEnvelope: {
    type: 'object',
    description: 'Standard error envelope.',
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: {
            type: 'string',
            description:
              'Machine-readable code, e.g. VALIDATION_ERROR (422), UNAUTHENTICATED (401), INVALID_CREDENTIALS (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT / EMAIL_TAKEN (409), CAPACITY_UNAVAILABLE (409), INVALID_STATE_TRANSITION (409), PRECONDITION_FAILED (412), PAYMENT_FAILED (402), PAYMENT_WEBHOOK_INVALID (400), RATE_LIMITED (429), ACCOUNT_SUSPENDED (403), INTERNAL_ERROR (500).',
          },
          message: { type: 'string', description: 'Human-readable message, safe to show to users.' },
          issues: {
            type: 'array',
            description: 'Present on 422 VALIDATION_ERROR.',
            items: {
              type: 'object',
              properties: { path: { type: 'string' }, message: { type: 'string' } },
            },
          },
          details: {
            type: 'object',
            description: 'Optional structured extras (e.g. details.fields on validation errors).',
            additionalProperties: true,
          },
        },
      },
      requestId: { type: 'string' },
    },
    example: {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        issues: [{ path: 'email', message: 'Enter a valid email address' }],
      },
      requestId: 'd2f8f0f4-4b3e-4d31-9a36-2a7db9e5a1c7',
    },
  },
  PaginationMeta: {
    type: 'object',
    properties: {
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
      totalPages: { type: 'integer' },
      hasNextPage: { type: 'boolean' },
      hasPreviousPage: { type: 'boolean' },
    },
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['CUSTOMER', 'PARTNER', 'ADMIN'] },
      phone: { type: 'string' },
      avatarUrl: { type: 'string' },
      emailVerified: { type: 'boolean' },
      status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  AuthSession: {
    type: 'object',
    description: 'Payload returned by register / login / refresh (cookies are set alongside).',
    properties: {
      user: { $ref: '#/components/schemas/User' },
      accessToken: { type: 'string', description: 'JWT; send as `Authorization: Bearer <token>`.' },
      csrfToken: { type: 'string', description: 'Echo in `X-CSRF-Token` on non-GET requests.' },
      emailConfig: { type: 'object', description: 'Email provider mode info.', additionalProperties: true },
    },
  },
  Category: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      type: { type: 'string', enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] },
      description: { type: 'string' },
      icon: { type: 'string' },
      imageUrl: { type: 'string' },
      parentId: { type: 'string' },
      listingCount: { type: 'integer' },
      isActive: { type: 'boolean' },
      sortOrder: { type: 'integer' },
    },
  },
  PlatformSettings: {
    type: 'object',
    properties: {
      currency: { type: 'string' },
      platformFeePercent: { type: 'number' },
      customerFeePercent: { type: 'number' },
      taxPercent: { type: 'number' },
      minPayoutAmount: { type: 'integer', description: 'Minor units.' },
      supportEmail: { type: 'string', format: 'email' },
      allowSelfServiceListings: { type: 'boolean' },
      requirePartnerVerification: { type: 'boolean' },
      maintenanceMode: { type: 'boolean' },
      announcement: { type: 'string' },
    },
  },
  Location: {
    type: 'object',
    properties: {
      addressLine1: { type: 'string' },
      addressLine2: { type: 'string' },
      landmark: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      postalCode: { type: 'string' },
      country: { type: 'string' },
      region: { type: 'string' },
      coordinates: {
        type: 'object',
        properties: { lat: { type: 'number' }, lng: { type: 'number' } },
      },
      serviceRadiusKm: { type: 'number' },
    },
  },
  ListingPrice: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        enum: ['FIXED', 'PER_SQFT', 'PER_SQMT', 'PER_PALLET', 'PER_UNIT', 'PER_HOUR', 'PER_DAY'],
      },
      amount: { type: 'integer', description: 'Minor units (paise).' },
      currency: { type: 'string' },
      period: { type: 'string', enum: ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'] },
      unitLabel: { type: 'string' },
      minQuantity: { type: 'integer' },
      additionalCharges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            amount: { type: 'integer', description: 'Minor units.' },
            taxable: { type: 'boolean' },
          },
        },
      },
    },
  },
  ListingSummary: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string', enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] },
      title: { type: 'string' },
      slug: { type: 'string' },
      status: {
        type: 'string',
        enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED', 'SUSPENDED', 'ARCHIVED'],
      },
      categoryId: { type: 'string' },
      categoryName: { type: 'string' },
      location: { $ref: '#/components/schemas/Location' },
      city: { type: 'string' },
      state: { type: 'string' },
      price: { $ref: '#/components/schemas/ListingPrice' },
      totalCapacity: { type: 'number' },
      capacityUnit: { type: 'string' },
      rating: {
        type: 'object',
        properties: { average: { type: 'number' }, count: { type: 'integer' } },
      },
      coverImage: { type: 'string' },
      images: { type: 'array', items: { type: 'string' } },
      partner: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          businessName: { type: 'string' },
          verified: { type: 'boolean' },
          logoUrl: { type: 'string' },
          rating: {
            type: 'object',
            properties: { average: { type: 'number' }, count: { type: 'integer' } },
          },
        },
      },
      availableFrom: { type: 'string', format: 'date-time' },
      isFavorite: { type: 'boolean', description: 'Only set for authenticated users (optionalAuth).' },
      createdAt: { type: 'string', format: 'date-time' },
      publishedAt: { type: 'string', format: 'date-time' },
    },
  },
  ListingDetail: {
    allOf: [
      { $ref: '#/components/schemas/ListingSummary' },
      {
        type: 'object',
        properties: {
          description: { type: 'string' },
          amenities: { type: 'array', items: { type: 'string' } },
          safetyFeatures: { type: 'array', items: { type: 'string' } },
          rules: { type: 'array', items: { type: 'string' } },
          minBookingDuration: {
            type: 'object',
            properties: { value: { type: 'integer' }, unit: { type: 'string' } },
          },
          cancellationTerms: {
            type: 'object',
            properties: {
              policy: { type: 'string' },
              description: { type: 'string' },
              customerRefundPercent: { type: 'integer' },
              note: { type: 'string' },
            },
          },
          warehouse: { type: 'object', description: 'Type-specific warehouse details.', additionalProperties: true },
          equipment: { type: 'object', description: 'Type-specific equipment details.', additionalProperties: true },
          service: { type: 'object', description: 'Type-specific service details.', additionalProperties: true },
          availabilityRules: { type: 'array', items: { $ref: '#/components/schemas/AvailabilityRule' } },
          blockedDates: { type: 'array', items: { $ref: '#/components/schemas/AvailabilityException' } },
          canRequestBooking: { type: 'boolean' },
          related: { type: 'array', items: { $ref: '#/components/schemas/ListingSummary' } },
        },
      },
    ],
  },
  SearchResponse: {
    type: 'object',
    properties: {
      items: { type: 'array', items: { $ref: '#/components/schemas/ListingSummary' } },
      sort: {
        type: 'string',
        enum: ['relevance', 'price_asc', 'price_desc', 'capacity_desc', 'rating_desc', 'newest', 'oldest'],
      },
      facets: {
        type: 'object',
        properties: {
          cities: { type: 'array', items: { type: 'object', additionalProperties: true } },
          categories: { type: 'array', items: { type: 'object', additionalProperties: true } },
          priceRange: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
  AvailabilityRule: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      daysOfWeek: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
      startTime: { type: 'string', example: '09:00' },
      endTime: { type: 'string', example: '18:00' },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
    },
  },
  AvailabilityException: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      date: { type: 'string', format: 'date-time' },
      reason: { type: 'string' },
      isAvailable: { type: 'boolean', description: '`false` blocks the date, `true` opens an otherwise closed date.' },
    },
  },
  AvailabilityView: {
    type: 'object',
    properties: {
      rules: { type: 'array', items: { $ref: '#/components/schemas/AvailabilityRule' } },
      blockedDates: { type: 'array', items: { $ref: '#/components/schemas/AvailabilityException' } },
    },
  },
  BookingPricing: {
    type: 'object',
    properties: {
      currency: { type: 'string' },
      subtotal: { type: 'integer', description: 'Minor units.' },
      platformFee: { type: 'integer', description: 'Minor units.' },
      taxes: { type: 'integer', description: 'Minor units.' },
      discount: { type: 'integer', description: 'Minor units.' },
      total: { type: 'integer', description: 'Minor units.' },
      breakdown: {
        type: 'array',
        items: {
          type: 'object',
          properties: { label: { type: 'string' }, amount: { type: 'integer' } },
        },
      },
      rateDescription: { type: 'string' },
    },
  },
  Booking: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      reference: { type: 'string' },
      type: { type: 'string', enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] },
      status: {
        type: 'string',
        enum: [
          'DRAFT',
          'PENDING_APPROVAL',
          'AWAITING_PAYMENT',
          'CONFIRMED',
          'IN_PROGRESS',
          'COMPLETED',
          'CANCELLED',
          'REJECTED',
          'REFUND_PENDING',
          'REFUNDED',
          'DISPUTED',
        ],
      },
      listing: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          slug: { type: 'string' },
          type: { type: 'string' },
          coverImage: { type: 'string' },
          city: { type: 'string' },
        },
      },
      customer: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, avatarUrl: { type: 'string' } },
      },
      partner: {
        type: 'object',
        properties: { id: { type: 'string' }, businessName: { type: 'string' }, verified: { type: 'boolean' } },
      },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      requestedCapacity: { type: 'number' },
      capacityUnit: { type: 'string' },
      quantity: { type: 'integer' },
      notes: { type: 'string' },
      specialRequirements: { type: 'string' },
      pricing: { $ref: '#/components/schemas/BookingPricing' },
      items: { type: 'array', items: { type: 'object', additionalProperties: true } },
      statusHistory: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            at: { type: 'string', format: 'date-time' },
            byRole: { type: 'string' },
            note: { type: 'string' },
          },
        },
      },
      allowedTransitions: { type: 'array', items: { type: 'string' } },
      cancellationReason: { type: 'string' },
      rejectionReason: { type: 'string' },
      invoiceId: { type: 'string' },
      reviewId: { type: 'string' },
      payment: { type: 'object', description: 'Embedded payment summary when one exists.', additionalProperties: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  Quote: {
    type: 'object',
    properties: {
      listingId: { type: 'string' },
      currency: { type: 'string' },
      pricing: {
        description: '`null` when the listing cannot be priced for the requested interval.',
        allOf: [{ $ref: '#/components/schemas/BookingPricing' }],
      },
      available: { type: 'boolean' },
      unavailableReason: { type: 'string' },
      remainingCapacity: { type: 'number' },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
    },
  },
  Payment: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      bookingId: { type: 'string' },
      reference: { type: 'string' },
      amount: { type: 'integer', description: 'Minor units.' },
      currency: { type: 'string' },
      status: {
        type: 'string',
        enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'],
      },
      provider: { type: 'string', enum: ['SANDBOX', 'RAZORPAY', 'STRIPE'] },
      method: { type: 'string' },
      paidAt: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Invoice: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      invoiceNumber: { type: 'string' },
      bookingId: { type: 'string' },
      bookingReference: { type: 'string' },
      status: { type: 'string', enum: ['DRAFT', 'ISSUED', 'PAID', 'VOID', 'REFUNDED'] },
      issuedTo: {
        type: 'object',
        properties: { name: { type: 'string' }, email: { type: 'string' }, address: { type: 'string' } },
      },
      issuedBy: {
        type: 'object',
        properties: { businessName: { type: 'string' }, address: { type: 'string' }, gstNumber: { type: 'string' } },
      },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unitAmount: { type: 'integer', description: 'Minor units.' },
            amount: { type: 'integer', description: 'Minor units.' },
          },
        },
      },
      subtotal: { type: 'integer', description: 'Minor units.' },
      platformFee: { type: 'integer', description: 'Minor units.' },
      taxAmount: { type: 'integer', description: 'Minor units.' },
      total: { type: 'integer', description: 'Minor units.' },
      currency: { type: 'string' },
      paidAt: { type: 'string', format: 'date-time' },
      dueAt: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
      pdfUrl: { type: 'string' },
    },
  },
  Review: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      bookingId: { type: 'string' },
      listingId: { type: 'string' },
      listingTitle: { type: 'string' },
      author: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, avatarUrl: { type: 'string' } },
      },
      rating: { type: 'integer', minimum: 1, maximum: 5 },
      comment: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'PUBLISHED', 'HIDDEN', 'REMOVED'] },
      response: {
        type: 'object',
        properties: { text: { type: 'string' }, at: { type: 'string', format: 'date-time' } },
      },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Conversation: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      subject: { type: 'string' },
      listing: { type: 'object', additionalProperties: true },
      participants: { type: 'array', items: { type: 'object', additionalProperties: true } },
      lastMessage: { type: 'object', additionalProperties: true },
      unreadCount: { type: 'integer' },
      status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED'] },
      updatedAt: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Message: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      conversationId: { type: 'string' },
      sender: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, avatarUrl: { type: 'string' } },
      },
      body: { type: 'string' },
      readBy: { type: 'array', items: { type: 'string' } },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Notification: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string' },
      title: { type: 'string' },
      body: { type: 'string' },
      link: { type: 'string' },
      read: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Favorite: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      listing: { $ref: '#/components/schemas/ListingSummary' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Dispute: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      reference: { type: 'string' },
      bookingId: { type: 'string' },
      bookingReference: { type: 'string' },
      openedBy: { type: 'object', additionalProperties: true },
      againstParty: { type: 'string', enum: ['CUSTOMER', 'PARTNER'] },
      reason: {
        type: 'string',
        enum: ['SERVICE_NOT_DELIVERED', 'QUALITY_ISSUE', 'OVERCHARGE', 'CANCELLATION_REFUND', 'DAMAGE', 'OTHER'],
      },
      description: { type: 'string' },
      status: {
        type: 'string',
        enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED_CUSTOMER', 'RESOLVED_PARTNER', 'CLOSED', 'WITHDRAWN'],
      },
      resolutionNote: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PartnerProfile: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      businessName: { type: 'string' },
      businessType: { type: 'string' },
      description: { type: 'string' },
      address: { $ref: '#/components/schemas/Location' },
      website: { type: 'string' },
      logoUrl: { type: 'string' },
      verificationStatus: {
        type: 'string',
        enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'],
      },
      verification: { type: 'object', description: 'KYC submission (GST/PAN, documents).', additionalProperties: true },
      responseRate: { type: 'number' },
      averageResponseMinutes: { type: 'number' },
      totalBookings: { type: 'integer' },
      activeListings: { type: 'integer' },
      joinedAt: { type: 'string', format: 'date-time' },
      payoutDetails: { type: 'object', description: 'Account number stored masked.', additionalProperties: true },
    },
  },
  PartnerDashboard: {
    type: 'object',
    properties: {
      verificationStatus: { type: 'string' },
      totals: {
        type: 'object',
        properties: {
          activeListings: { type: 'integer' },
          draftListings: { type: 'integer' },
          pendingRequests: { type: 'integer' },
          confirmedBookings: { type: 'integer' },
          completedBookings: { type: 'integer' },
          cancelledBookings: { type: 'integer' },
          unreadMessages: { type: 'integer' },
          averageRating: { type: 'number' },
          reviewCount: { type: 'integer' },
        },
      },
      revenue: {
        type: 'object',
        properties: {
          currency: { type: 'string' },
          totalEarned: { type: 'integer', description: 'Minor units.' },
          pendingPayout: { type: 'integer', description: 'Minor units.' },
          last30Days: { type: 'integer', description: 'Minor units.' },
        },
      },
      responseRate: { type: 'number' },
      trends: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            bookings: { type: 'integer' },
            revenue: { type: 'integer' },
          },
        },
      },
      upcomingBookings: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
      recentRequests: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
    },
  },
  AdminDashboard: {
    type: 'object',
    properties: {
      totals: {
        type: 'object',
        properties: {
          customers: { type: 'integer' },
          partners: { type: 'integer' },
          verifiedPartners: { type: 'integer' },
          listings: { type: 'integer' },
          activeListings: { type: 'integer' },
          bookings: { type: 'integer' },
          pendingBookings: { type: 'integer' },
          disputesOpen: { type: 'integer' },
          pendingVerifications: { type: 'integer' },
          pendingListings: { type: 'integer' },
        },
      },
      revenue: {
        type: 'object',
        properties: {
          currency: { type: 'string' },
          grossCollected: { type: 'integer' },
          platformFees: { type: 'integer' },
          refunds: { type: 'integer' },
          netCollected: { type: 'integer' },
          periodDays: { type: 'integer' },
        },
      },
      trends: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            bookings: { type: 'integer' },
            grossAmount: { type: 'integer' },
          },
        },
      },
      recentBookings: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
      recentDisputes: { type: 'array', items: { $ref: '#/components/schemas/Dispute' } },
    },
  },
  AuditLog: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      actor: { type: 'object', additionalProperties: true },
      action: { type: 'string' },
      entityType: { type: 'string' },
      entityId: { type: 'string' },
      summary: { type: 'string' },
      metadata: { type: 'object', additionalProperties: true },
      ip: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
};

/* ------------------------------------------------------------------ */
/* Component responses                                                 */
/* ------------------------------------------------------------------ */

function errorResponse(description: string): Json {
  return {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  };
}

const componentResponses: Json = {
  BadRequest: errorResponse(
    '400 — BAD_REQUEST (malformed payload/query) or PAYMENT_WEBHOOK_INVALID (webhook signature mismatch).',
  ),
  Unauthenticated: errorResponse(
    '401 — UNAUTHENTICATED (missing/expired token), INVALID_CREDENTIALS (bad login), ACCOUNT_SUSPENDED, or a failed/expired refresh.',
  ),
  Forbidden: errorResponse(
    '403 — FORBIDDEN (role mismatch or deactivated account) or a missing/invalid CSRF token on a cookie-authenticated non-GET request.',
  ),
  NotFound: errorResponse('404 — NOT_FOUND (unknown id/slug, unpublished listing, or unknown route).'),
  Conflict: errorResponse(
    '409 — CONFLICT / EMAIL_TAKEN, CAPACITY_UNAVAILABLE (booking over capacity), INVALID_STATE_TRANSITION (illegal booking action), duplicate review, etc.',
  ),
  PreconditionFailed: errorResponse(
    '412 — PRECONDITION_FAILED (e.g. reviewing a booking that is not COMPLETED).',
  ),
  ValidationFailed: errorResponse('422 — VALIDATION_ERROR; `error.issues[]` lists `{ path, message }` per field.'),
  RateLimited: errorResponse('429 — RATE_LIMITED (baseline /api limiter or the credential-endpoint limiter).'),
};

/* ------------------------------------------------------------------ */
/* Path groups                                                         */
/* ------------------------------------------------------------------ */

function authPaths(): PathMap {
  const sessionData: Json = {
    type: 'object',
    properties: {
      user: { $ref: '#/components/schemas/User' },
      profile: { type: 'object', description: 'Role-specific profile.', additionalProperties: true },
      platform: { $ref: '#/components/schemas/PlatformSettings' },
    },
  };

  return {
    '/auth/bootstrap': {
      get: {
        tags: ['Auth'],
        summary: 'Get frontend bootstrap info',
        description: 'Public. App URLs and the configured email-provider mode for the three frontends.',
        responses: {
          '200': ok('Bootstrap info.', {
            type: 'object',
            properties: {
              apps: {
                type: 'object',
                properties: {
                  customer: { type: 'string' },
                  partner: { type: 'string' },
                  admin: { type: 'string' },
                },
              },
              email: { type: 'object', description: 'Email provider mode.', additionalProperties: true },
            },
          }),
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a customer or partner account',
        description:
          'Public, rate-limited. Sets the httpOnly refresh cookie `bmw_rt` (path `/api/v1/auth`) and the readable `bmw_csrf` cookie. `role` may only be CUSTOMER or PARTNER.',
        requestBody: jsonBody({
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 80 },
            email: { type: 'string', format: 'email', maxLength: 254 },
            password: { type: 'string', minLength: 8, maxLength: 72, description: 'At least one letter and one digit.' },
            role: { type: 'string', enum: ['CUSTOMER', 'PARTNER'], default: 'CUSTOMER' },
            phone: { type: 'string', description: 'Optional.' },
            businessName: { type: 'string', maxLength: 120, description: 'Optional; partner business name.' },
          },
        }),
        responses: {
          '201': ok('Registered; auth cookies set.', { $ref: '#/components/schemas/AuthSession' }),
          ...errs('400', '409', '422', '429'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        description: 'Public, rate-limited. Sets the same auth cookies as register.',
        requestBody: jsonBody({
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1, maxLength: 72 },
            rememberMe: { type: 'boolean' },
          },
        }),
        responses: {
          '200': ok('Session created.', { $ref: '#/components/schemas/AuthSession' }),
          ...errs('400', '401', '422', '429'),
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password-reset link',
        description:
          'Public, rate-limited. Returns 200 for any valid email even when no account exists. `emailConfig` lets dev frontends surface the reset link.',
        requestBody: jsonBody({
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        }),
        responses: {
          '200': ok('Reset link dispatched (or simulated in dev).', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              emailConfig: { type: 'object', additionalProperties: true },
            },
          }),
          ...rateLimitedWrite(),
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset a password using a token',
        description: 'Public, rate-limited. The token comes from the reset link sent by forgot-password.',
        requestBody: jsonBody({
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string', minLength: 10, maxLength: 200 },
            password: { type: 'string', minLength: 8, maxLength: 72 },
          },
        }),
        responses: {
          '200': ok('Password updated.', {
            type: 'object',
            properties: { message: { type: 'string' } },
          }),
          ...rateLimitedWrite(),
        },
      },
    },
    '/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify an email address using a token',
        description: 'Public. Token from the verification email.',
        requestBody: jsonBody({
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string', minLength: 10, maxLength: 400 } },
        }),
        responses: {
          '200': ok('Email verified.', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/User' }, message: { type: 'string' } },
          }),
          ...publicWrite(),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the session and mint a new access token',
        description:
          'Uses the httpOnly `bmw_rt` refresh cookie. When the readable `bmw_csrf` cookie is present, its value must be echoed in `X-CSRF-Token` (double-submit). Rate-limited; sets fresh cookies.',
        security: [{ cookieAuth: [], csrfToken: [] }],
        requestBody: jsonBody({ type: 'object' }, 'Empty JSON object.', false),
        responses: {
          '200': ok('New session issued.', { $ref: '#/components/schemas/AuthSession' }),
          ...errs('400', '401', '422', '429'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out and clear auth cookies',
        description:
          'Public (works even without a session). Clears `bmw_rt` and `bmw_csrf`. Send `X-CSRF-Token` when the `bmw_csrf` cookie exists.',
        requestBody: jsonBody({ type: 'object' }, 'Empty JSON object.', false),
        responses: {
          '200': ok('Logged out.', {
            type: 'object',
            properties: { loggedOut: { type: 'boolean' } },
          }),
          ...publicWrite(),
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current user and profile',
        description:
          'Authenticated. Returns the user, the role-specific profile (customer profile or partner profile) and platform settings. Alias: GET /me.',
        security: AUTH_SECURITY,
        responses: { '200': ok('Current session profile.', sessionData), ...authRead() },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update the current user profile',
        description: 'Authenticated. Alias: PATCH /me.',
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 80 },
            phone: { type: 'string' },
            avatarUrl: { type: 'string', description: 'https URL or uploaded data:image URI.' },
          },
        }),
        responses: {
          '200': ok('Updated user.', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/User' } },
          }),
          ...authWrite(),
        },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change the password of the signed-in user',
        description: 'Authenticated.',
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', minLength: 1, maxLength: 72 },
            newPassword: { type: 'string', minLength: 8, maxLength: 72 },
          },
        }),
        responses: {
          '200': ok('Password changed.', {
            type: 'object',
            properties: { message: { type: 'string' } },
          }),
          ...authWrite(),
        },
      },
    },
    '/auth/admin-ping': {
      get: {
        tags: ['Auth'],
        summary: 'Verify admin access',
        description: `Authenticated, ${ADMIN_NOTE} Used by the admin app to confirm its session.`,
        security: AUTH_SECURITY,
        responses: {
          '200': ok('Admin session OK.', {
            type: 'object',
            properties: { ok: { type: 'boolean' }, userId: { type: 'string' } },
          }),
          ...errs('401', '403'),
        },
      },
    },
    '/auth/session': {
      get: {
        tags: ['Auth'],
        summary: 'Check whether the caller is authenticated',
        description: 'Optional auth: never fails; reports whether a valid bearer token was supplied.',
        responses: {
          '200': ok('Session probe result.', {
            type: 'object',
            properties: {
              authenticated: { type: 'boolean' },
              role: { type: 'string', enum: ['CUSTOMER', 'PARTNER', 'ADMIN'] },
            },
          }),
        },
      },
    },
  };
}

function catalogPaths(): PathMap {
  const searchParams: Json[] = [
    pageParam,
    limitParam(12),
    queryParam('q', 'Free-text search over title/description/city.', { type: 'string', maxLength: 120 }),
    queryParam('type', 'Listing type filter.', { type: 'string', enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] }),
    queryParam('city', 'Exact city filter.', { type: 'string', maxLength: 80 }),
    queryParam('state', 'Exact state filter.', { type: 'string', maxLength: 80 }),
    queryParam('region', 'Free-form region filter (e.g. "Bhiwandi").', { type: 'string', maxLength: 120 }),
    queryParam('categoryId', 'Category ObjectId.', { type: 'string' }),
    queryParam('facilityType', 'Warehouse facility type.', {
      type: 'string',
      enum: [
        'GENERAL',
        'INDUSTRIAL',
        'COMMERCIAL',
        'DISTRIBUTION',
        'COLD_STORAGE',
        'FULFILLMENT',
        'SHORT_TERM',
        'LONG_TERM',
        'OTHER',
      ],
    }),
    queryParam('storageType', 'Warehouse storage type.', {
      type: 'string',
      enum: ['GENERAL', 'COLD', 'FROZEN', 'HAZARDOUS', 'BONDED', 'AGRICULTURE', 'PHARMACEUTICAL', 'OTHER'],
    }),
    queryParam('equipmentCategory', 'Equipment category.', {
      type: 'string',
      enum: ['FORKLIFT', 'CRANE', 'PALLET_TRUCK', 'MATERIAL_HANDLING', 'LOADING', 'GENERATOR', 'OTHER'],
    }),
    queryParam('serviceType', 'Service type.', {
      type: 'string',
      enum: [
        'LOADING_UNLOADING',
        'PACKAGING',
        'TRANSPORTATION',
        'MATERIAL_HANDLING',
        'INVENTORY_MANAGEMENT',
        'CONSULTING',
        'OTHER',
      ],
    }),
    queryParam('minPrice', 'Minimum price (minor units).', { type: 'number', minimum: 0 }),
    queryParam('maxPrice', 'Maximum price (minor units).', { type: 'number', minimum: 0 }),
    queryParam('capacityMin', 'Minimum capacity.', { type: 'number', minimum: 0 }),
    queryParam('capacityMax', 'Maximum capacity.', { type: 'number', minimum: 0 }),
    queryParam('amenities', 'Comma-separated amenity names.', { type: 'string', maxLength: 300 }),
    queryParam('verifiedOnly', 'Only verified partners (`true`/`false`).', { type: 'string', enum: ['true', 'false'] }),
    queryParam('minRating', 'Minimum average rating (1-5).', { type: 'number', minimum: 1, maximum: 5 }),
    queryParam('availableFrom', 'Only listings available from this date.', { type: 'string', format: 'date' }),
    queryParam('availableTo', 'Only listings available until this date.', { type: 'string', format: 'date' }),
    queryParam('lat', 'Latitude for distance search.', { type: 'number', minimum: -90, maximum: 90 }),
    queryParam('lng', 'Longitude for distance search.', { type: 'number', minimum: -180, maximum: 180 }),
    queryParam('radiusKm', 'Radius in km for distance search (requires lat/lng).', {
      type: 'number',
      minimum: 0,
      maximum: 1000,
    }),
    queryParam('sort', 'Sort order.', {
      type: 'string',
      enum: ['relevance', 'price_asc', 'price_desc', 'capacity_desc', 'rating_desc', 'newest', 'oldest'],
      default: 'relevance',
    }),
  ];

  const searchOp: Operation = {
    tags: ['Catalog'],
    summary: 'Search listings',
    description:
      'Public. `optionalAuth` personalizes results (`isFavorite`) when a bearer token is sent. Response: `{ items, sort, facets }` + `meta.pagination`. Mounted at both paths.',
    parameters: searchParams,
    responses: {
      '200': ok('Search results.', { $ref: '#/components/schemas/SearchResponse' }),
      ...publicValidated(),
    },
  };

  return {
    '/catalog/settings': {
      get: {
        tags: ['Catalog'],
        summary: 'Get public platform settings',
        description: 'Public. Currency, fee percentages, feature flags, announcement and maintenance mode.',
        responses: {
          '200': ok('Platform settings.', { $ref: '#/components/schemas/PlatformSettings' }),
          ...publicRead(),
        },
      },
    },
    '/catalog/categories': {
      get: {
        tags: ['Catalog'],
        summary: 'List categories',
        description: 'Public.',
        parameters: [
          queryParam('type', 'Filter by listing type.', {
            type: 'string',
            enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'],
          }),
        ],
        responses: {
          '200': ok('Categories.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Category' } } },
          }),
          ...publicValidated(),
        },
      },
    },
    '/catalog/categories/{slug}': {
      get: {
        tags: ['Catalog'],
        summary: 'Get one category by slug',
        description: 'Public.',
        parameters: [pathParam('slug', 'Category slug.')],
        responses: { '200': ok('Category.', { $ref: '#/components/schemas/Category' }), ...publicRead() },
      },
    },
    '/catalog/search': { get: searchOp },
    '/catalog/listings': {
      get: { ...searchOp, summary: 'Search listings (alias of /catalog/search)' },
    },
    '/catalog/listings/{slug}': {
      get: {
        tags: ['Catalog'],
        summary: 'Get a listing detail by slug',
        description: 'Public with optional personalization. 404 unless the listing is PUBLISHED.',
        parameters: [pathParam('slug', 'Listing slug.')],
        responses: {
          '200': ok('Listing detail.', { $ref: '#/components/schemas/ListingDetail' }),
          ...publicRead(),
        },
      },
    },
    '/catalog/listings/{id}/reviews': {
      get: {
        tags: ['Catalog'],
        summary: 'List reviews for a listing',
        description: 'Public. Returns `{ items, average }` + `meta.pagination`.',
        parameters: [
          pathParam('id', 'Listing ObjectId (slug also accepted by the handler).'),
          pageParam,
          limitParam(12),
          queryParam('minRating', 'Only reviews with at least this rating.', {
            type: 'integer',
            minimum: 1,
            maximum: 5,
          }),
          queryParam('sort', 'Sort order.', {
            type: 'string',
            enum: ['newest', 'oldest', 'rating_desc', 'rating_asc'],
            default: 'newest',
          }),
        ],
        responses: {
          '200': ok('Listing reviews.', {
            type: 'object',
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
              average: { type: 'number' },
            },
          }),
          ...publicValidated(),
        },
      },
    },
    '/catalog/listings/{id}/availability': {
      get: {
        tags: ['Catalog'],
        summary: 'Get availability rules and blocked dates for a listing',
        description: 'Public.',
        parameters: [pathParam('id', 'Listing ObjectId.')],
        responses: {
          '200': ok('Availability.', { $ref: '#/components/schemas/AvailabilityView' }),
          ...publicRead(),
        },
      },
    },
    '/catalog/listings/{slug}/similar': {
      get: {
        tags: ['Catalog'],
        summary: 'Get similar listings',
        description: 'Public. At most 4 items.',
        parameters: [pathParam('slug', 'Listing slug.')],
        responses: {
          '200': ok('Similar listings.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/ListingSummary' } } },
          }),
          ...publicRead(),
        },
      },
    },
  };
}

function bookingPaths(): PathMap {
  return {
    '/bookings/quote': {
      post: {
        tags: ['Bookings'],
        summary: 'Quote a booking (price + availability)',
        description:
          'Public (optionalAuth) — usable from the listing page before login. Returns pricing in minor units, availability and remaining capacity.',
        requestBody: jsonBody(quoteBody),
        responses: {
          '200': ok('Quote for the requested interval.', { $ref: '#/components/schemas/Quote' }),
          ...errs('400', '404', '422'),
        },
      },
    },
    '/bookings': {
      post: {
        tags: ['Bookings'],
        summary: 'Request a booking',
        description:
          'Authenticated. Creates a booking in status `PENDING_APPROVAL`. 409 CAPACITY_UNAVAILABLE when the requested interval exceeds remaining capacity. Money fields are minor units.',
        security: AUTH_SECURITY,
        requestBody: jsonBody(createBookingBody),
        responses: {
          '201': ok('Booking created.', { $ref: '#/components/schemas/Booking' }),
          ...authConflictWrite(),
        },
      },
      get: {
        tags: ['Bookings'],
        summary: 'List bookings',
        description: `Authenticated. ${SCOPED_BOOKINGS_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [
          pageParam,
          limitParam(12),
          statusParam('Booking status filter; comma-separated list accepted.', 300),
          queryParam('type', 'Listing type filter.', {
            type: 'string',
            enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'],
          }),
          qParam,
          queryParam('from', 'Bookings starting on/after this date.', { type: 'string', format: 'date' }),
          queryParam('to', 'Bookings starting on/before this date.', { type: 'string', format: 'date' }),
          queryParam('scope', 'Set to `admin` for the admin-wide view (admins only).', {
            type: 'string',
            enum: ['admin'],
          }),
        ],
        responses: {
          '200': ok('Bookings page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Booking' } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/bookings/{id}': {
      get: {
        tags: ['Bookings'],
        summary: 'Get a booking by id',
        description: `Authenticated. 403/404 for unrelated users. ${SCOPED_BOOKINGS_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Booking ObjectId.')],
        responses: { '200': ok('Booking.', { $ref: '#/components/schemas/Booking' }), ...authRead() },
      },
    },
    '/bookings/{id}/accept': {
      post: {
        tags: ['Bookings'],
        summary: 'Partner approves a booking request',
        description:
          'Authenticated (partner of the listing, or admin). `PENDING_APPROVAL` → `AWAITING_PAYMENT` (or `CONFIRMED` when the total is 0). Illegal transitions return 409 INVALID_STATE_TRANSITION.',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Booking ObjectId.')],
        responses: {
          '200': ok('Updated booking.', { $ref: '#/components/schemas/Booking' }),
          ...authConflictWrite(),
        },
      },
    },
    '/bookings/{id}/reject': {
      post: {
        tags: ['Bookings'],
        summary: 'Partner rejects a booking request',
        description: 'Authenticated (partner of the listing, or admin).',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Booking ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['reason'],
          properties: { reason: { type: 'string', minLength: 3, maxLength: 600 } },
        }),
        responses: {
          '200': ok('Updated booking.', { $ref: '#/components/schemas/Booking' }),
          ...authConflictWrite(),
        },
      },
    },
    '/bookings/{id}/start': {
      post: {
        tags: ['Bookings'],
        summary: 'Mark a booking as started',
        description: 'Authenticated (partner or admin). `CONFIRMED` → `IN_PROGRESS`.',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Booking ObjectId.')],
        responses: {
          '200': ok('Updated booking.', { $ref: '#/components/schemas/Booking' }),
          ...authConflictWrite(),
        },
      },
    },
    '/bookings/{id}/complete': {
      post: {
        tags: ['Bookings'],
        summary: 'Mark a booking as completed',
        description: 'Authenticated (partner or admin). Enables the customer review flow.',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Booking ObjectId.')],
        requestBody: jsonBody(
          { type: 'object', properties: { note: { type: 'string', maxLength: 600 } } },
          'Optional completion note.',
          false,
        ),
        responses: {
          '200': ok('Updated booking.', { $ref: '#/components/schemas/Booking' }),
          ...authConflictWrite(),
        },
      },
    },
    '/bookings/{id}/cancel': {
      post: {
        tags: ['Bookings'],
        summary: 'Cancel a booking (refund policy applied)',
        description: 'Authenticated (customer, partner or admin). Returns the booking plus the refund amount.',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Booking ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['reason'],
          properties: { reason: { type: 'string', minLength: 3, maxLength: 600 } },
        }),
        responses: {
          '200': ok('Cancellation result.', {
            type: 'object',
            properties: {
              booking: { $ref: '#/components/schemas/Booking' },
              refundAmountMinor: { type: 'integer' },
            },
          }),
          ...authConflictWrite(),
        },
      },
    },
    '/bookings/{id}/dispute': {
      post: {
        tags: ['Bookings'],
        summary: 'Open a dispute for a booking',
        description: 'Authenticated (booking participant).',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Booking ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['bookingId', 'reason', 'description'],
          properties: {
            bookingId: { type: 'string', description: 'Must match the path id.' },
            reason: {
              type: 'string',
              enum: ['SERVICE_NOT_DELIVERED', 'QUALITY_ISSUE', 'OVERCHARGE', 'CANCELLATION_REFUND', 'DAMAGE', 'OTHER'],
            },
            description: { type: 'string', minLength: 20, maxLength: 3000 },
          },
        }),
        responses: {
          '201': ok('Dispute opened.', {
            type: 'object',
            properties: { id: { type: 'string' }, reference: { type: 'string' } },
          }),
          ...authConflictWrite(),
        },
      },
    },
  };
}

function paymentPaths(): PathMap {
  return {
    '/payments/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Payment-provider webhook (sandbox gateway)',
        description:
          'No session auth — authenticity comes from the HMAC signature header `X-Payments-Signature` computed over the raw JSON body (raw bytes preserved by the parser). CSRF-exempt. On success responds with a raw `{ received: true, ... }` object (not the standard envelope).',
        security: [{ webhookSignature: [] }],
        requestBody: jsonBody(
          { type: 'object', additionalProperties: true, description: 'Provider event (event type, payment reference, status, amounts…).' },
          'Signed provider event.',
        ),
        responses: {
          '200': {
            description: 'Event accepted.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { received: { type: 'boolean' } },
                  additionalProperties: true,
                },
              },
            },
          },
          ...errs('400'),
        },
      },
    },
    '/payments/simulate': {
      post: {
        tags: ['Payments'],
        summary: 'Simulate a gateway outcome (sandbox only)',
        description:
          'Authenticated. Drives the webhook machinery with the requested outcome; a SUCCESS confirms the booking.',
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          required: ['paymentId', 'outcome'],
          properties: {
            paymentId: { type: 'string', description: 'Payment ObjectId.' },
            outcome: { type: 'string', enum: ['SUCCESS', 'FAILURE'] },
          },
        }),
        responses: {
          '200': ok('Simulation result (payment + booking status).', {
            type: 'object',
            additionalProperties: true,
          }),
          ...authWrite(),
        },
      },
    },
    '/payments/bookings/{bookingId}/initiate': {
      post: {
        tags: ['Payments'],
        summary: 'Initiate payment for a booking',
        description: 'Authenticated (customer who owns the booking). Returns a checkout URL for the sandbox gateway.',
        security: AUTH_SECURITY,
        parameters: [pathParam('bookingId', 'Booking ObjectId.')],
        responses: {
          '200': ok('Payment initiated.', {
            type: 'object',
            properties: {
              payment: { $ref: '#/components/schemas/Payment' },
              checkoutUrl: { type: 'string' },
              sandbox: { type: 'boolean' },
              message: { type: 'string' },
            },
          }),
          ...authConflictWrite(),
        },
      },
    },
    '/payments': {
      get: {
        tags: ['Payments'],
        summary: 'List the current customer payment history',
        description: 'Authenticated. Latest 50 payments for the caller’s bookings (no pagination).',
        security: AUTH_SECURITY,
        responses: {
          '200': ok('Payments.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Payment' } } },
          }),
          ...errs('401', '403'),
        },
      },
    },
    '/payments/invoices': {
      get: {
        tags: ['Payments'],
        summary: 'List own invoices',
        description:
          'Authenticated. Customers see invoices where they are the customer; partners see invoices for their bookings. Admin-wide listing lives at GET /admin/invoices.',
        security: AUTH_SECURITY,
        parameters: [pageParam, limitParam(12)],
        responses: {
          '200': ok('Invoices page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Invoice' } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/payments/invoices/{id}': {
      get: {
        tags: ['Payments'],
        summary: 'Get an invoice',
        description: 'Authenticated. Admins may view any invoice; other roles only their own (otherwise 403/404).',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Invoice ObjectId.')],
        responses: { '200': ok('Invoice.', { $ref: '#/components/schemas/Invoice' }), ...authRead() },
      },
    },
    '/payments/invoices/{id}/html': {
      get: {
        tags: ['Payments'],
        summary: 'Render an invoice as HTML',
        description: 'Authenticated. Returns `text/html` (open in a new tab / print to PDF), same visibility rules as GET /payments/invoices/{id}.',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Invoice ObjectId.')],
        responses: {
          '200': {
            description: 'Rendered invoice HTML.',
            content: { 'text/html': { schema: { type: 'string' } } },
          },
          '401': ERROR_REFS['401'] as Json,
          '403': ERROR_REFS['403'] as Json,
          '404': ERROR_REFS['404'] as Json,
        },
      },
    },
  };
}

function partnerPaths(): PathMap {
  const roleSecurity = AUTH_SECURITY;
  const listingsQuery: Json[] = [
    pageParam,
    limitParam(12),
    statusParam('Listing status filter (comma-separated accepted).'),
    queryParam('type', 'Listing type filter.', {
      type: 'string',
      enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'],
    }),
    qParam,
  ];

  return {
    '/partner/profile': {
      get: {
        tags: ['Partner'],
        summary: 'Get the partner profile',
        description: `Authenticated. ${PARTNER_NOTE} Payout details are masked.`,
        security: roleSecurity,
        responses: {
          '200': ok('Partner profile.', { $ref: '#/components/schemas/PartnerProfile' }),
          ...authRead(),
        },
      },
    },
    '/partner/onboarding': {
      post: {
        tags: ['Partner'],
        summary: 'Create or update business onboarding info',
        description: `Authenticated. ${PARTNER_NOTE}`,
        security: roleSecurity,
        requestBody: jsonBody({
          type: 'object',
          required: ['businessName', 'address', 'supportedTypes'],
          properties: {
            businessName: { type: 'string', minLength: 2, maxLength: 120 },
            businessType: {
              type: 'string',
              enum: [
                'SOLE_PROPRIETORSHIP',
                'PARTNERSHIP',
                'PRIVATE_LIMITED',
                'PUBLIC_LIMITED',
                'LLP',
                'HUF',
                'OTHER',
              ],
              default: 'SOLE_PROPRIETORSHIP',
            },
            description: { type: 'string', maxLength: 2000 },
            address: locationBody,
            website: { type: 'string', description: 'Valid http(s) URL.' },
            logoUrl: { type: 'string', description: 'https URL or data:image URI.' },
            supportedTypes: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string', enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] },
            },
          },
        }),
        responses: {
          '200': ok('Profile saved.', { $ref: '#/components/schemas/PartnerProfile' }),
          ...authWrite(),
        },
      },
    },
    '/partner/verification': {
      post: {
        tags: ['Partner'],
        summary: 'Submit KYC / business verification',
        description: `Authenticated. ${PARTNER_NOTE} Enters the admin verification queue as SUBMITTED.`,
        security: roleSecurity,
        requestBody: jsonBody({
          type: 'object',
          required: ['legalBusinessName', 'businessType', 'address', 'documents'],
          properties: {
            legalBusinessName: { type: 'string', minLength: 2, maxLength: 160 },
            businessType: {
              type: 'string',
              enum: [
                'SOLE_PROPRIETORSHIP',
                'PARTNERSHIP',
                'PRIVATE_LIMITED',
                'PUBLIC_LIMITED',
                'LLP',
                'HUF',
                'OTHER',
              ],
            },
            gstNumber: { type: 'string', pattern: '^[0-9A-Z]{15}$', description: '15 characters.' },
            panNumber: { type: 'string', pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$', description: 'e.g. ABCDE1234F.' },
            registrationNumber: { type: 'string', maxLength: 60 },
            address: locationBody,
            documents: {
              type: 'array',
              minItems: 1,
              maxItems: 10,
              items: {
                type: 'object',
                required: ['label', 'url'],
                properties: {
                  label: { type: 'string', minLength: 2, maxLength: 120 },
                  url: { type: 'string', description: 'Uploaded document URL (https or data URI).' },
                },
              },
            },
          },
        }),
        responses: {
          '200': ok('Verification submitted / updated.', {
            type: 'object',
            additionalProperties: true,
          }),
          ...authWrite(),
        },
      },
    },
    '/partner/payout-details': {
      patch: {
        tags: ['Partner'],
        summary: 'Save payout (bank) details',
        description: `Authenticated. ${PARTNER_NOTE} The account number is stored masked.`,
        security: roleSecurity,
        requestBody: jsonBody({
          type: 'object',
          required: ['accountHolderName', 'accountNumber', 'ifsc', 'bankName'],
          properties: {
            accountHolderName: { type: 'string', minLength: 2, maxLength: 120 },
            accountNumber: { type: 'string', pattern: '^[0-9]{6,20}$' },
            ifsc: { type: 'string', pattern: '^[A-Z]{4}0[A-Z0-9]{6}$' },
            bankName: { type: 'string', minLength: 2, maxLength: 120 },
            upiId: { type: 'string', description: 'Optional UPI VPA.' },
          },
        }),
        responses: {
          '200': ok('Payout details saved.', {
            type: 'object',
            properties: { message: { type: 'string' } },
          }),
          ...authWrite(),
        },
      },
    },
    '/partner/dashboard': {
      get: {
        tags: ['Partner'],
        summary: 'Partner dashboard aggregates',
        description: `Authenticated. ${PARTNER_NOTE} Totals, revenue (minor units), response rate and booking trends.`,
        security: roleSecurity,
        responses: {
          '200': ok('Dashboard.', { $ref: '#/components/schemas/PartnerDashboard' }),
          ...authRead(),
        },
      },
    },
    '/partner/earnings': {
      get: {
        tags: ['Partner'],
        summary: 'List earnings entries',
        description: `Authenticated. ${PARTNER_NOTE}`,
        security: roleSecurity,
        parameters: [pageParam, limitParam(12)],
        responses: {
          '200': ok('Earnings page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { type: 'object', additionalProperties: true } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/partner/listings': {
      get: {
        tags: ['Partner'],
        summary: 'List own listings',
        description: `Authenticated. ${PARTNER_NOTE}`,
        security: roleSecurity,
        parameters: listingsQuery,
        responses: {
          '200': ok('Own listings page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/ListingSummary' } } },
          }),
          ...authReadValidated(),
        },
      },
      post: {
        tags: ['Partner'],
        summary: 'Create a listing (draft)',
        description:
          'Authenticated. `PARTNER` or `ADMIN`. The type-specific block (`warehouse` / `equipment` / `service`) must match `type`. Price amounts are MAJOR units here; responses return minor units.',
        security: roleSecurity,
        requestBody: jsonBody(listingCreateBody),
        responses: {
          '201': ok('Listing created.', {
            type: 'object',
            properties: {
              id: { type: 'string' },
              slug: { type: 'string' },
              status: { type: 'string', enum: ['DRAFT', 'PENDING_REVIEW'] },
            },
          }),
          ...authConflictWrite(),
        },
      },
    },
    '/partner/listings/{id}': {
      get: {
        tags: ['Partner'],
        summary: 'Get own listing detail',
        description: `Authenticated. ${PARTNER_NOTE} 403 for other partners’ listings.`,
        security: roleSecurity,
        parameters: [pathParam('id', 'Listing ObjectId.')],
        responses: {
          '200': ok('Listing detail.', { $ref: '#/components/schemas/ListingDetail' }),
          ...authRead(),
        },
      },
      patch: {
        tags: ['Partner'],
        summary: 'Update own listing',
        description: 'Authenticated (owner or admin). Partial update; use `clear*` flags to drop type blocks.',
        security: roleSecurity,
        parameters: [pathParam('id', 'Listing ObjectId.')],
        requestBody: jsonBody(listingUpdateBody),
        responses: {
          '200': ok('Listing updated.', {
            type: 'object',
            properties: {
              id: { type: 'string' },
              slug: { type: 'string' },
              status: { type: 'string' },
            },
          }),
          ...authConflictWrite(),
        },
      },
      delete: {
        tags: ['Partner'],
        summary: 'Delete own listing (soft delete)',
        description: 'Authenticated (owner or admin).',
        security: roleSecurity,
        parameters: [pathParam('id', 'Listing ObjectId.')],
        responses: {
          '200': ok('Deleted.', {
            type: 'object',
            properties: { deleted: { type: 'boolean' } },
          }),
          ...authRead(),
        },
      },
    },
    '/partner/listings/{id}/publish': {
      post: {
        tags: ['Partner'],
        summary: 'Publish a listing',
        description: 'Authenticated (owner or admin). Moves the listing to `PENDING_REVIEW`; an admin approves it to `PUBLISHED`.',
        security: roleSecurity,
        parameters: [pathParam('id', 'Listing ObjectId.')],
        responses: {
          '200': ok('Status changed.', {
            type: 'object',
            properties: { id: { type: 'string' }, status: { type: 'string' } },
          }),
          ...authConflictWrite(),
        },
      },
    },
    '/partner/listings/{id}/unpublish': {
      post: {
        tags: ['Partner'],
        summary: 'Unpublish a listing',
        description: 'Authenticated (owner or admin). Listing leaves the public catalog.',
        security: roleSecurity,
        parameters: [pathParam('id', 'Listing ObjectId.')],
        responses: {
          '200': ok('Status changed.', {
            type: 'object',
            properties: { id: { type: 'string' }, status: { type: 'string' } },
          }),
          ...authConflictWrite(),
        },
      },
    },
    '/partner/listings/{id}/archive': {
      post: {
        tags: ['Partner'],
        summary: 'Archive a listing',
        description: 'Authenticated (owner or admin).',
        security: roleSecurity,
        parameters: [pathParam('id', 'Listing ObjectId.')],
        responses: {
          '200': ok('Status changed.', {
            type: 'object',
            properties: { id: { type: 'string' }, status: { type: 'string' } },
          }),
          ...authConflictWrite(),
        },
      },
    },
    '/partner/listings/{id}/availability': {
      get: {
        tags: ['Partner'],
        summary: 'Get availability rules and blocked dates for own listing',
        description: `Authenticated. ${PARTNER_NOTE}`,
        security: roleSecurity,
        parameters: [pathParam('id', 'Listing ObjectId.')],
        responses: {
          '200': ok('Availability.', { $ref: '#/components/schemas/AvailabilityView' }),
          ...authRead(),
        },
      },
    },
    '/partner/availability-rules': {
      post: {
        tags: ['Partner'],
        summary: 'Add a weekly availability rule',
        description: `Authenticated. ${PARTNER_NOTE}`,
        security: roleSecurity,
        requestBody: jsonBody({
          type: 'object',
          required: ['listingId', 'daysOfWeek', 'startTime', 'endTime'],
          properties: {
            listingId: { type: 'string', description: 'Listing ObjectId.' },
            daysOfWeek: {
              type: 'array',
              minItems: 1,
              maxItems: 7,
              items: { type: 'integer', minimum: 0, maximum: 6, description: '0 = Sunday … 6 = Saturday.' },
            },
            startTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '09:00' },
            endTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '18:00' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
          },
        }),
        responses: {
          '201': ok('Rule created.', { $ref: '#/components/schemas/AvailabilityRule' }),
          ...authConflictWrite(),
        },
      },
    },
    '/partner/availability-rules/{id}': {
      delete: {
        tags: ['Partner'],
        summary: 'Delete an availability rule',
        description: `Authenticated. ${PARTNER_NOTE}`,
        security: roleSecurity,
        parameters: [pathParam('id', 'Availability rule ObjectId.')],
        responses: {
          '200': ok('Deleted.', {
            type: 'object',
            properties: { deleted: { type: 'boolean' } },
          }),
          ...authRead(),
        },
      },
    },
    '/partner/availability-exceptions': {
      post: {
        tags: ['Partner'],
        summary: 'Block or open a specific date',
        description: `Authenticated. ${PARTNER_NOTE} \`isAvailable=false\` blocks the date, \`true\` opens an otherwise closed date.`,
        security: roleSecurity,
        requestBody: jsonBody({
          type: 'object',
          required: ['listingId', 'date'],
          properties: {
            listingId: { type: 'string' },
            date: { type: 'string', format: 'date' },
            reason: { type: 'string', maxLength: 300 },
            isAvailable: { type: 'boolean', default: false },
          },
        }),
        responses: {
          '201': ok('Exception created.', { $ref: '#/components/schemas/AvailabilityException' }),
          ...authConflictWrite(),
        },
      },
    },
    '/partner/availability-exceptions/{id}': {
      delete: {
        tags: ['Partner'],
        summary: 'Delete an availability exception',
        description: `Authenticated. ${PARTNER_NOTE}`,
        security: roleSecurity,
        parameters: [pathParam('id', 'Availability exception ObjectId.')],
        responses: {
          '200': ok('Deleted.', {
            type: 'object',
            properties: { deleted: { type: 'boolean' } },
          }),
          ...authRead(),
        },
      },
    },
  };
}

function socialPaths(): PathMap {
  return {
    '/me': {
      get: {
        tags: ['Social'],
        summary: 'Get the current user and profile',
        description: 'Authenticated. Same payload as GET /auth/me.',
        security: AUTH_SECURITY,
        responses: {
          '200': ok('Current session profile.', {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              profile: { type: 'object', additionalProperties: true },
              platform: { $ref: '#/components/schemas/PlatformSettings' },
            },
          }),
          ...authRead(),
        },
      },
      patch: {
        tags: ['Social'],
        summary: 'Update the current user profile',
        description: 'Authenticated. Same payload as PATCH /auth/me.',
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 80 },
            phone: { type: 'string' },
            avatarUrl: { type: 'string' },
          },
        }),
        responses: {
          '200': ok('Updated user.', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/User' } },
          }),
          ...authWrite(),
        },
      },
    },
    '/uploads': {
      post: {
        tags: ['Social'],
        summary: 'Upload an image (data URI → stored URL)',
        description:
          'Authenticated. Accepts a browser-produced data URI (or https URL); stored inline in dev or via Cloudinary when configured.',
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          required: ['file'],
          properties: {
            file: { type: 'string', description: 'data:image/...;base64,... (max ~2 MB) or https URL.' },
            folder: {
              type: 'string',
              enum: ['listings', 'avatars', 'documents', 'logos'],
              default: 'listings',
            },
          },
        }),
        responses: {
          '201': ok('Uploaded.', {
            type: 'object',
            properties: { url: { type: 'string' } },
          }),
          ...authWrite(),
        },
      },
    },
    '/me/reviews': {
      get: {
        tags: ['Social'],
        summary: 'List reviews written by / about the current user',
        description:
          'Authenticated. Customers get their own reviews; partners get reviews of their listings plus an `average`.',
        security: AUTH_SECURITY,
        parameters: [
          pageParam,
          limitParam(10, 50),
          queryParam('listingId', 'Restrict to one listing.', { type: 'string' }),
          queryParam('minRating', 'Minimum rating (1-5).', { type: 'integer', minimum: 1, maximum: 5 }),
          queryParam('sort', 'Sort order.', {
            type: 'string',
            enum: ['newest', 'oldest', 'rating_desc', 'rating_asc'],
            default: 'newest',
          }),
        ],
        responses: {
          '200': ok('Own reviews page.', {
            type: 'object',
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
              average: { type: 'number', description: 'Partners only.' },
            },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/reviews': {
      post: {
        tags: ['Social'],
        summary: 'Create a review for a completed booking',
        description:
          'Authenticated (booking owner, `COMPLETED` booking, one review per booking). Violations return 403 / 412 / 409 respectively.',
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          required: ['bookingId', 'rating'],
          properties: {
            bookingId: { type: 'string' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string', maxLength: 2000 },
          },
        }),
        responses: {
          '201': ok('Review created.', {
            type: 'object',
            properties: { id: { type: 'string' } },
          }),
          ...errs('400', '401', '403', '404', '409', '412', '422'),
        },
      },
    },
    '/reviews/{id}/respond': {
      post: {
        tags: ['Social'],
        summary: 'Partner response to a review',
        description: 'Authenticated. Only the partner of the reviewed listing may respond.',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Review ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['text'],
          properties: { text: { type: 'string', minLength: 5, maxLength: 2000 } },
        }),
        responses: {
          '200': ok('Response saved.', {
            type: 'object',
            properties: {
              id: { type: 'string' },
              response: {
                type: 'object',
                properties: { text: { type: 'string' }, at: { type: 'string', format: 'date-time' } },
              },
            },
          }),
          ...authConflictWrite(),
        },
      },
    },
    '/favorites': {
      get: {
        tags: ['Social'],
        summary: 'List favorite listings',
        description: 'Authenticated.',
        security: AUTH_SECURITY,
        parameters: [pageParam, limitParam(12)],
        responses: {
          '200': ok('Favorites page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Favorite' } } },
          }),
          ...authReadValidated(),
        },
      },
      post: {
        tags: ['Social'],
        summary: 'Toggle a listing in the favorites list',
        description: 'Authenticated. Idempotent toggle.',
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          required: ['listingId'],
          properties: { listingId: { type: 'string' } },
        }),
        responses: {
          '200': ok('Toggle result.', {
            type: 'object',
            properties: { active: { type: 'boolean', description: 'Whether the listing is now favorited.' } },
          }),
          ...authWrite(),
        },
      },
    },
    '/notifications': {
      get: {
        tags: ['Social'],
        summary: 'List notifications',
        description: 'Authenticated. Returns `{ unread, items }` + `meta.pagination`.',
        security: AUTH_SECURITY,
        parameters: [
          pageParam,
          limitParam(20, 50),
          queryParam('unreadOnly', 'Only unread notifications (`true`/`false`).', {
            type: 'string',
            enum: ['true', 'false'],
          }),
        ],
        responses: {
          '200': ok('Notifications page.', {
            type: 'object',
            properties: {
              unread: { type: 'integer' },
              items: { type: 'array', items: { $ref: '#/components/schemas/Notification' } },
            },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/notifications/read': {
      post: {
        tags: ['Social'],
        summary: 'Mark notifications as read',
        description: 'Authenticated. Without `ids`, marks all notifications read.',
        security: AUTH_SECURITY,
        requestBody: jsonBody(
          { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } },
          'Optional list of notification ids.',
          false,
        ),
        responses: {
          '200': ok('Updated.', {
            type: 'object',
            properties: { ok: { type: 'boolean' }, unread: { type: 'integer' } },
          }),
          ...authWrite(),
        },
      },
    },
    '/conversations': {
      get: {
        tags: ['Social'],
        summary: 'List message threads',
        description: 'Authenticated. Returns `{ items, unreadTotal }` + `meta.pagination`.',
        security: AUTH_SECURITY,
        parameters: [
          pageParam,
          limitParam(20, 50),
          qParam,
          queryParam('includeArchived', 'Include archived threads (`true`/`false`).', {
            type: 'string',
            enum: ['true', 'false'],
          }),
        ],
        responses: {
          '200': ok('Conversations page.', {
            type: 'object',
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/Conversation' } },
              unreadTotal: { type: 'integer' },
            },
          }),
          ...authReadValidated(),
        },
      },
      post: {
        tags: ['Social'],
        summary: 'Start a conversation',
        description: 'Authenticated. Provide `listingId` and/or `toUserId` plus a subject and first message body.',
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          required: ['subject', 'body'],
          properties: {
            listingId: { type: 'string' },
            toUserId: { type: 'string' },
            subject: { type: 'string', minLength: 3, maxLength: 160 },
            body: { type: 'string', minLength: 1, maxLength: 4000 },
          },
        }),
        responses: {
          '201': ok('Conversation created.', {
            type: 'object',
            properties: { conversationId: { type: 'string' }, messageId: { type: 'string' } },
          }),
          ...authConflictWrite(),
        },
      },
    },
    '/conversations/{id}/messages': {
      get: {
        tags: ['Social'],
        summary: 'List messages in a conversation',
        description: 'Authenticated (participant only).',
        security: AUTH_SECURITY,
        parameters: [
          pathParam('id', 'Conversation ObjectId.'),
          pageParam,
          limitParam(30),
          queryParam('before', 'Cursor: return messages created before this id/timestamp.', {
            type: 'string',
            maxLength: 40,
          }),
        ],
        responses: {
          '200': ok('Messages page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Message' } } },
          }),
          ...authReadValidated(),
        },
      },
      post: {
        tags: ['Social'],
        summary: 'Send a message in a conversation',
        description: 'Authenticated (participant only).',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Conversation ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['body'],
          properties: { body: { type: 'string', minLength: 1, maxLength: 4000 } },
        }),
        responses: {
          '201': ok('Message sent.', { $ref: '#/components/schemas/Message' }),
          ...authConflictWrite(),
        },
      },
    },
    '/conversations/{id}/read': {
      post: {
        tags: ['Social'],
        summary: 'Mark messages in a conversation as read',
        description: 'Authenticated (participant only). Without `ids`, marks the whole thread read.',
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Conversation ObjectId.')],
        requestBody: jsonBody(
          { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } },
          'Optional list of message ids.',
          false,
        ),
        responses: {
          '200': ok('Marked read.', {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
          }),
          ...authWrite(),
        },
      },
    },
    '/disputes': {
      get: {
        tags: ['Social'],
        summary: 'List disputes raised by the current user',
        description: 'Authenticated. Returns `{ items, total }` (no pagination meta).',
        security: AUTH_SECURITY,
        responses: {
          '200': ok('Own disputes.', {
            type: 'object',
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/Dispute' } },
              total: { type: 'integer' },
            },
          }),
          ...errs('401', '403'),
        },
      },
    },
  };
}

function adminPaths(): PathMap {
  const listBase: Json[] = [pageParam, limitParam(12), qParam];
  const okTrue: Json = {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
  };

  return {
    '/admin/dashboard': {
      get: {
        tags: ['Admin'],
        summary: 'Admin dashboard aggregates',
        description: `Authenticated. ${ADMIN_NOTE} Totals, revenue (minor units), trends and recent bookings/disputes.`,
        security: AUTH_SECURITY,
        responses: { '200': ok('Dashboard.', { $ref: '#/components/schemas/AdminDashboard' }), ...authRead() },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [
          ...listBase,
          statusParam('Account status filter (ACTIVE / SUSPENDED / DEACTIVATED).', 40),
          queryParam('role', 'Role filter (CUSTOMER / PARTNER / ADMIN).', { type: 'string', maxLength: 40 }),
        ],
        responses: {
          '200': ok('Users page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/User' } } },
          }),
          ...authReadValidated(),
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a user (admin console)',
        description: `Authenticated. ${ADMIN_NOTE} Unlike public register, any role (including ADMIN) is allowed.`,
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 80 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8, maxLength: 72 },
            role: { type: 'string', enum: ['CUSTOMER', 'PARTNER', 'ADMIN'] },
            phone: { type: 'string', maxLength: 20 },
            address: locationBody,
          },
        }),
        responses: {
          '201': ok('User created.', { $ref: '#/components/schemas/User' }),
          ...errs('400', '401', '403', '409', '422'),
        },
      },
    },
    '/admin/users/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Suspend / reactivate / deactivate a user',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'User ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['SUSPEND', 'REACTIVATE', 'DEACTIVATE'] },
            reason: { type: 'string', maxLength: 600 },
          },
        }),
        responses: { '200': ok('Moderation applied.', okTrue), ...authWrite() },
      },
    },
    '/admin/partners': {
      get: {
        tags: ['Admin'],
        summary: 'List partners',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [
          ...listBase,
          statusParam('Account status filter.'),
          queryParam('verificationStatus', 'KYC status filter (DRAFT / SUBMITTED / UNDER_REVIEW / VERIFIED / REJECTED / SUSPENDED).', {
            type: 'string',
            maxLength: 40,
          }),
        ],
        responses: {
          '200': ok('Partners page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { type: 'object', additionalProperties: true } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/admin/partners/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Get a partner with full KYC detail',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Partner user ObjectId.')],
        responses: {
          '200': ok('Partner detail.', { type: 'object', additionalProperties: true }),
          ...authRead(),
        },
      },
    },
    '/admin/partners/{id}/decision': {
      post: {
        tags: ['Admin'],
        summary: 'Approve / reject / suspend a partner KYC',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Partner user ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['APPROVE', 'REJECT', 'SUSPEND'] },
            reason: { type: 'string', maxLength: 800 },
            notes: { type: 'string', maxLength: 2000 },
          },
        }),
        responses: { '200': ok('Decision recorded.', okTrue), ...authConflictWrite() },
      },
    },
    '/admin/verification-queue': {
      get: {
        tags: ['Admin'],
        summary: 'KYC verification queue',
        description: `Authenticated. ${ADMIN_NOTE} Defaults to status SUBMITTED.`,
        security: AUTH_SECURITY,
        parameters: [
          ...listBase,
          queryParam('status', 'Verification status (defaults to SUBMITTED).', {
            type: 'string',
            maxLength: 40,
          }),
        ],
        responses: {
          '200': ok('Queue page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { type: 'object', additionalProperties: true } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/admin/listings': {
      get: {
        tags: ['Admin'],
        summary: 'List all listings (moderation view)',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [
          ...listBase,
          statusParam('Listing status filter (DRAFT / PENDING_REVIEW / PUBLISHED / …).'),
          queryParam('type', 'Listing type filter.', {
            type: 'string',
            enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'],
          }),
        ],
        responses: {
          '200': ok('Listings page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/ListingSummary' } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/admin/listings/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Moderate a listing (approve / reject / suspend)',
        description: `Authenticated. ${ADMIN_NOTE} Approving a PENDING_REVIEW listing publishes it.`,
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Listing ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['APPROVE', 'REJECT', 'SUSPEND', 'UNSUSPEND'] },
            reason: { type: 'string', maxLength: 800 },
          },
        }),
        responses: { '200': ok('Moderation applied.', okTrue), ...authConflictWrite() },
      },
    },
    '/admin/payments': {
      get: {
        tags: ['Admin'],
        summary: 'List all payments',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [
          ...listBase,
          statusParam('Payment status filter (PENDING / SUCCEEDED / FAILED / REFUNDED / …).', 40),
        ],
        responses: {
          '200': ok('Payments page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Payment' } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/admin/refunds': {
      get: {
        tags: ['Admin'],
        summary: 'List refunds',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [
          ...listBase,
          statusParam('Refund status filter (PENDING / PROCESSING / COMPLETED / FAILED / REJECTED).', 40),
        ],
        responses: {
          '200': ok('Refunds page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { type: 'object', additionalProperties: true } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/admin/refunds/{id}/process': {
      post: {
        tags: ['Admin'],
        summary: 'Process a pending refund',
        description: `Authenticated. ${ADMIN_NOTE} Transitions the refund through the gateway sandbox.`,
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Refund ObjectId.')],
        responses: { '200': ok('Refund processed.', okTrue), ...authConflictWrite() },
      },
    },
    '/admin/invoices': {
      get: {
        tags: ['Admin'],
        summary: 'List all invoices',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [pageParam, limitParam(12)],
        responses: {
          '200': ok('Invoices page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Invoice' } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/admin/disputes': {
      get: {
        tags: ['Admin'],
        summary: 'List all disputes',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [
          ...listBase,
          statusParam('Dispute status filter (OPEN / UNDER_REVIEW / RESOLVED_CUSTOMER / …).', 40),
        ],
        responses: {
          '200': ok('Disputes page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Dispute' } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/admin/disputes/{id}/resolve': {
      post: {
        tags: ['Admin'],
        summary: 'Resolve a dispute',
        description: `Authenticated. ${ADMIN_NOTE} An optional \`refundAmount\` (minor units) may accompany the resolution.`,
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Dispute ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['resolution', 'resolutionNote'],
          properties: {
            resolution: { type: 'string', enum: ['RESOLVED_CUSTOMER', 'RESOLVED_PARTNER', 'CLOSED'] },
            resolutionNote: { type: 'string', minLength: 5, maxLength: 2000 },
            refundAmount: { type: 'integer', minimum: 0, description: 'Optional refund in minor units.' },
          },
        }),
        responses: { '200': ok('Dispute resolved.', okTrue), ...authConflictWrite() },
      },
    },
    '/admin/categories': {
      get: {
        tags: ['Admin'],
        summary: 'List categories (including inactive)',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [
          queryParam('includeInactive', 'Include inactive categories (`true`/`false`).', {
            type: 'string',
            enum: ['true', 'false'],
          }),
        ],
        responses: {
          '200': ok('Categories.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Category' } } },
          }),
          ...authRead(),
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a category',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          required: ['name', 'slug', 'type'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 80 },
            slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
            type: { type: 'string', enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] },
            description: { type: 'string', maxLength: 600 },
            icon: { type: 'string', maxLength: 60 },
            imageUrl: { type: 'string', maxLength: 1000 },
            parentId: { type: 'string' },
            isActive: { type: 'boolean', default: true },
            sortOrder: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
          },
        }),
        responses: {
          '201': ok('Category created.', { $ref: '#/components/schemas/Category' }),
          ...authConflictWrite(),
        },
      },
    },
    '/admin/categories/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update a category',
        description: `Authenticated. ${ADMIN_NOTE} Partial update (all fields optional).`,
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Category ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 80 },
            slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
            type: { type: 'string', enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] },
            description: { type: 'string', maxLength: 600 },
            icon: { type: 'string', maxLength: 60 },
            imageUrl: { type: 'string', maxLength: 1000 },
            parentId: { type: 'string' },
            isActive: { type: 'boolean' },
            sortOrder: { type: 'integer', minimum: 0, maximum: 10000 },
          },
        }),
        responses: { '200': ok('Category updated.', okTrue), ...authWrite() },
      },
    },
    '/admin/reviews': {
      get: {
        tags: ['Admin'],
        summary: 'List reviews (moderation view)',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [pageParam, limitParam(12), qParam],
        responses: {
          '200': ok('Reviews page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Review' } } },
          }),
          ...authReadValidated(),
        },
      },
    },
    '/admin/reviews/{id}/moderate': {
      post: {
        tags: ['Admin'],
        summary: 'Moderate a review (publish / hide / remove)',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [pathParam('id', 'Review ObjectId.')],
        requestBody: jsonBody({
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['PUBLISHED', 'HIDDEN', 'REMOVED'] },
            note: { type: 'string', maxLength: 400 },
          },
        }),
        responses: { '200': ok('Review moderated.', okTrue), ...authWrite() },
      },
    },
    '/admin/settings': {
      get: {
        tags: ['Admin'],
        summary: 'Get platform settings',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        responses: {
          '200': ok('Settings.', { $ref: '#/components/schemas/PlatformSettings' }),
          ...authRead(),
        },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Update platform settings',
        description: `Authenticated. ${ADMIN_NOTE} Partial update; recorded in the audit log.`,
        security: AUTH_SECURITY,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            currency: { type: 'string', minLength: 3, maxLength: 3 },
            platformFeePercent: { type: 'number', minimum: 0, maximum: 50 },
            customerFeePercent: { type: 'number', minimum: 0, maximum: 50 },
            taxPercent: { type: 'number', minimum: 0, maximum: 50 },
            minPayoutAmount: { type: 'integer', minimum: 0 },
            supportEmail: { type: 'string', format: 'email' },
            allowSelfServiceListings: { type: 'boolean' },
            requirePartnerVerification: { type: 'boolean' },
            maintenanceMode: { type: 'boolean' },
            announcement: { type: 'string', maxLength: 600 },
          },
        }),
        responses: {
          '200': ok('Updated settings.', { $ref: '#/components/schemas/PlatformSettings' }),
          ...authWrite(),
        },
      },
    },
    '/admin/audit-logs': {
      get: {
        tags: ['Admin'],
        summary: 'List audit log entries',
        description: `Authenticated. ${ADMIN_NOTE}`,
        security: AUTH_SECURITY,
        parameters: [
          ...listBase,
          queryParam('action', 'Exact/substring action filter (e.g. `listing.published`).', {
            type: 'string',
            maxLength: 120,
          }),
          queryParam('entityType', 'Entity type filter (e.g. `Booking`, `Payment`).', {
            type: 'string',
            maxLength: 80,
          }),
          queryParam('entityId', 'Entity id filter.', { type: 'string', maxLength: 80 }),
        ],
        responses: {
          '200': ok('Audit log page.', {
            type: 'object',
            properties: { items: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } } },
          }),
          ...authReadValidated(),
        },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* The spec                                                            */
/* ------------------------------------------------------------------ */

export const openapiSpec: Json = {
  openapi: '3.0.3',
  info: {
    title: 'BookMyWarehouse API',
    version: '1.0.0',
    description: [
      'REST API for the BookMyWarehouse warehouse-rental marketplace (customer, partner and admin frontends).',
      'Base path: `/api/v1`.',
      '',
      '**Response envelopes.**',
      'Success: `{ "success": true, "data": ..., "meta": { "pagination": ... }?, "requestId": "uuid" }`.',
      'Error: `{ "success": false, "error": { "code", "message", "issues"? , "details"? }, "requestId": "uuid" }`.',
      'Common error codes: VALIDATION_ERROR (422, `error.issues[]` per field), UNAUTHENTICATED (401),',
      'INVALID_CREDENTIALS (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT / EMAIL_TAKEN (409),',
      'CAPACITY_UNAVAILABLE (409), INVALID_STATE_TRANSITION (409), PRECONDITION_FAILED (412),',
      'RATE_LIMITED (429), PAYMENT_FAILED (402), PAYMENT_WEBHOOK_INVALID (400), ACCOUNT_SUSPENDED (403),',
      'INTERNAL_ERROR (500).',
      '',
      '**Authentication.** Obtain an access token from `POST /auth/login`, `POST /auth/register` or',
      '`POST /auth/refresh` and send it as `Authorization: Bearer <accessToken>` (preferred, works for all',
      'clients). Browser clients additionally receive an httpOnly refresh cookie `bmw_rt` (path `/api/v1/auth`)',
      'and a readable `bmw_csrf` cookie; every non-GET request made with those cookies must echo `bmw_csrf` in',
      'the `X-CSRF-Token` header (double-submit CSRF). GET / HEAD / OPTIONS are exempt from CSRF.',
      'Endpoints marked "optionalAuth" never fail without a token; a valid token only personalizes the result.',
      '',
      '**Roles.** `CUSTOMER`, `PARTNER`, `ADMIN` (uppercase). Partner endpoints accept PARTNER or ADMIN;',
      'admin endpoints require ADMIN. Booking visibility is automatically role-scoped.',
      '',
      '**Money.** Amounts in responses are integer minor units (paise). The listing create/update request',
      'body takes `price.amount` in major units.',
      '',
      '**Rate limits.** A baseline limiter applies to `/api/v1` and a stricter one to credential endpoints',
      '(register / login / forgot-password / reset-password / refresh) — both return 429 RATE_LIMITED.',
      '',
      '**This documentation.** Served by the API itself: JSON spec at `GET /api/v1/openapi.json`,',
      'Swagger UI at `GET /api/v1/docs`. Both are public (no auth, not rate-limited).',
    ].join('\n'),
  },
  servers: [
    { url: '/api/v1', description: 'Same-origin (this host).' },
    { url: 'http://localhost:4000/api/v1', description: 'Local development server.' },
  ],
  tags: [
    { name: 'Auth', description: 'Registration, login, session cookies and profile.' },
    { name: 'Catalog', description: 'Public browsing: settings, categories, listing search and detail.' },
    { name: 'Bookings', description: 'Quote, booking lifecycle and disputes.' },
    { name: 'Payments', description: 'Checkout initiation, sandbox simulation, webhook, payments and invoices.' },
    { name: 'Partner', description: 'Partner onboarding, KYC, listings and availability (PARTNER or ADMIN).' },
    { name: 'Social', description: 'Profile, uploads, reviews, favorites, notifications, messaging, disputes.' },
    { name: 'Admin', description: 'Moderation, finance, categories, settings and audit trail (ADMIN).' },
  ],
  security: [],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Preferred. `Authorization: Bearer <accessToken>` — the token returned as `data.accessToken` by register / login / refresh.',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'bmw_rt',
        description:
          'httpOnly refresh cookie (path `/api/v1/auth`), paired with the readable `bmw_csrf` cookie. Browser sessions use this plus the `X-CSRF-Token` header on non-GET requests.',
      },
      csrfToken: {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description:
          'Must equal the readable `bmw_csrf` cookie on every non-GET request when that cookie exists. GET / HEAD / OPTIONS are exempt; login / register / forgot-password / reset-password / verify-email and the payment webhook are also exempt.',
      },
      webhookSignature: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Payments-Signature',
        description:
          'HMAC-SHA256 signature of the raw JSON body computed with the payment webhook secret. Session auth is not used for the webhook.',
      },
    },
    schemas: componentSchemas,
    responses: componentResponses,
  },
  paths: {
    ...authPaths(),
    ...catalogPaths(),
    ...bookingPaths(),
    ...paymentPaths(),
    ...partnerPaths(),
    ...socialPaths(),
    ...adminPaths(),
  },
};

export default openapiSpec;
