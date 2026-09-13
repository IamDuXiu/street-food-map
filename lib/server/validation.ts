import { z } from 'zod';

export const verificationMethods = [
  'onsite_menu',
  'receipt',
  'official_menu',
  'phone_check',
  'community_confirmed',
  'external_lead',
] as const;
/** Methods that are evidence of a completed independent verification. */
export const verifiedVerificationMethods = [
  'onsite_menu',
  'receipt',
  'official_menu',
  'phone_check',
  'community_confirmed',
] as const;
export type VerificationMethod = (typeof verificationMethods)[number];
export type VerifiedVerificationMethod =
  (typeof verifiedVerificationMethods)[number];
export const placeSchema = z
  .object({
    zoneId: z.string().min(1).max(80),
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().min(1).max(240),
    lng: z.number().finite(),
    lat: z.number().finite(),
    category: z.string().min(1).max(40),
    accessType: z.string().min(1).max(40),
    accessNote: z.string().max(240).optional(),
    businessStatus: z
      .enum(['open', 'temporarily_closed', 'closed', 'unknown'])
      .default('unknown'),
    openingHoursNote: z.string().max(240).optional(),
    tags: z.array(z.string().max(30)).max(12).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.lng < 113.6 || value.lng > 114.7)
      ctx.addIssue({
        code: 'custom',
        path: ['lng'],
        message: '经度必须在深圳试点范围内',
      });
    if (value.lat < 22.4 || value.lat > 22.9)
      ctx.addIssue({
        code: 'custom',
        path: ['lat'],
        message: '纬度必须在深圳试点范围内',
      });
  });
export const placePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    address: z.string().trim().min(1).max(240).optional(),
    category: z.string().min(1).max(40).optional(),
    accessType: z.string().min(1).max(40).optional(),
    accessNote: z.string().max(240).optional(),
    openingHoursNote: z.string().max(240).optional(),
    businessStatus: z
      .enum(['open', 'temporarily_closed', 'closed', 'unknown'])
      .optional(),
    recordStatus: z.enum(['active', 'archived']).optional(),
  })
  .strict();
export const leadPatchSchema = z
  .object({
    sourcePlatform: z.enum(['douban', 'web', 'user', 'other']).optional(),
    sourceUrl: z.string().url().optional().or(z.literal('')),
    cluePlaceName: z.string().trim().min(1).max(120).optional(),
    clueItemName: z.string().max(120).optional(),
    cluePriceFen: z.number().int().positive().optional(),
    sourcePublishedAt: z.string().date().optional(),
    summary: z.string().max(500).optional(),
    status: z
      .enum([
        'new',
        'triaged',
        'verifying',
        'converted',
        'rejected',
        'duplicate',
      ])
      .optional(),
    matchedPlaceId: z.string().optional(),
    discoveryMethod: z.string().trim().min(1).max(60).optional(),
  })
  .strict();
export const menuPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    category: z.string().min(1).max(40).optional(),
    description: z.string().max(240).optional(),
    active: z.boolean().optional(),
  })
  .strict();
export const priceStatusSchema = z
  .object({
    status: z.enum([
      'pending',
      'verified',
      'disputed',
      'superseded',
      'archived',
    ]),
  })
  .strict();
export const priceStatusRequestSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum([
      'pending',
      'verified',
      'disputed',
      'superseded',
      'archived',
    ]),
  })
  .strict();
export const mergeRequestSchema = z
  .object({
    action: z.enum(['preview', 'merge']),
    duplicateId: z.string().min(1),
    confirm: z.literal(true).optional(),
    version: z.string().min(1).optional(),
  })
  .strict();
export const mealSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  category: z.string().min(1).max(40),
  description: z.string().max(240).optional(),
  active: z.boolean().default(true),
});
export const priceSchema = z.object({
  menuItemId: z.string().min(1),
  priceFen: z.number().int().positive().max(100000),
  observedAt: z.string().date(),
  verificationMethod: z.enum(verifiedVerificationMethods),
  note: z.string().max(500).optional(),
  status: z.enum(['pending', 'verified', 'disputed']).default('verified'),
});
export const leadSchema = z.object({
  sourcePlatform: z.enum(['douban', 'web', 'user', 'other']),
  discoveryMethod: z.string().trim().min(1).max(60).optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  cluePlaceName: z.string().trim().min(1).max(120),
  clueItemName: z.string().max(120).optional(),
  cluePriceFen: z.number().int().positive().optional(),
  sourcePublishedAt: z.string().date().optional(),
  summary: z.string().max(500).optional(),
  status: z
    .enum(['new', 'triaged', 'verifying', 'converted', 'rejected', 'duplicate'])
    .default('new'),
  matchedPlaceId: z.string().optional(),
});
const plainText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[<>]/.test(value), '不能包含 HTML 标记');
const optionalPlainText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !/[<>]/.test(value), '不能包含 HTML 标记')
    .optional();
export const submissionSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('new_place'),
        zoneId: plainText(80),
        placeName: plainText(120),
        address: plainText(240),
        lng: z
          .number()
          .finite()
          .refine(
            (value) => value >= 113.6 && value <= 114.7,
            '经度超出深圳范围',
          ),
        lat: z
          .number()
          .finite()
          .refine(
            (value) => value >= 22.4 && value <= 22.9,
            '纬度超出深圳范围',
          ),
        coordinateSystem: z.literal('GCJ-02'),
        placeCategory: plainText(40),
        menuItemName: plainText(120),
        priceFen: z.number().int().positive().max(2500),
        observedAt: z.string().date(),
        claimedVerificationMethod: z.enum(verificationMethods),
        menuCategory: optionalPlainText(40),
        accessType: optionalPlainText(40),
        accessNote: optionalPlainText(240),
        note: optionalPlainText(500),
      })
      .strict(),
    z
      .object({
        type: z.literal('new_price'),
        placeId: plainText(120),
        menuItemId: z.string().min(1).max(120).optional(),
        newMenuItemName: optionalPlainText(120),
        priceFen: z.number().int().positive().max(100000),
        observedAt: z.string().date(),
        claimedVerificationMethod: z.enum(verificationMethods),
        note: optionalPlainText(500),
      })
      .strict(),
    z
      .object({
        type: z.literal('correction'),
        placeId: plainText(120),
        field: z.enum([
          'place_name',
          'address',
          'access_type',
          'access_note',
          'opening_hours_note',
          'menu_item_name',
        ]),
        proposedValue: plainText(300),
        reason: plainText(500),
        menuItemId: z.string().max(120).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('closure'),
        placeId: plainText(120),
        closureType: z.enum(['temporarily_closed', 'closed']),
        observedAt: z.string().date(),
        reason: optionalPlainText(500),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (
      value.type === 'new_price' &&
      Boolean(value.menuItemId) === Boolean(value.newMenuItemName)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'menuItemId 与 newMenuItemName 必须二选一',
        path: ['menuItemId'],
      });
    if (
      value.type === 'correction' &&
      value.field === 'menu_item_name' &&
      !value.menuItemId
    )
      ctx.addIssue({
        code: 'custom',
        message: '请选择要修改的餐食',
        path: ['menuItemId'],
      });
    if (
      value.type === 'correction' &&
      value.field !== 'menu_item_name' &&
      value.menuItemId
    )
      ctx.addIssue({
        code: 'custom',
        message: '该纠错字段不接受餐食 ID',
        path: ['menuItemId'],
      });
  });
export type SubmissionPayload = z.infer<typeof submissionSchema>;
export const submissionApprovalSchema = z
  .object({
    id: z.string().min(1),
    decision: z.enum([
      'approved',
      'needs_verification',
      'rejected',
      'duplicate',
    ]),
    note: z.string().max(500).optional(),
    review: z
      .object({
        verificationMethod: z.enum(verifiedVerificationMethods),
        observedAt: z.string().date(),
        independentVerification: z.literal(true),
        note: z.string().max(500).optional(),
        publicMediaIds: z.array(z.string().min(1)).max(5).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const csvRowSchema = z.object({
  zone_name: z.string().trim().min(1),
  place_name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  lng: z.coerce.number(),
  lat: z.coerce.number(),
  coordinate_system: z.literal('GCJ-02'),
  place_category: z.string().trim().min(1),
  access_type: z.string().trim().min(1),
  menu_item_name: z.string().trim().min(1),
  menu_category: z.string().trim().min(1),
  price_yuan: z.coerce.number().positive().max(1000),
  observed_date: z.string().date(),
  verification_method: z.enum(verificationMethods),
  evidence_filename: z.string().max(240).optional().default(''),
  source_lead_url: z.string().url().optional().or(z.literal('')),
  admin_note: z.string().max(500).optional().default(''),
});
export type CsvRow = z.infer<typeof csvRowSchema>;

/** Facts are completed by a reviewer, never inferred from a source clue. */
export const candidateFactsSchema = z
  .object({
    open: z.literal(true),
    regularPrice: z.literal(true),
    oneMeal: z.literal(true),
  })
  .strict();
export type CandidateVerificationFacts = z.infer<typeof candidateFactsSchema>;

/** Candidate commits can only consume a persisted, versioned draft. */
export const candidateCommitRequestSchema = z
  .object({
    draftId: z.string().trim().min(1),
    version: z.union([
      z.number().int().positive(),
      z.string().trim().min(1).max(128),
    ]),
  })
  .strict();
export type CandidateCommitRequest = z.infer<
  typeof candidateCommitRequestSchema
>;

export const regionCreateSchema = z
  .object({
    id: z.string().trim().min(1).max(80).optional(),
    parentId: z.string().trim().max(80).default(''),
    name: plainText(60),
    level: z.enum(['city', 'district', 'business_area']),
    centerLng: z.number().finite(),
    centerLat: z.number().finite(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    zoom: z.number().int().min(1).max(20).default(12),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();
export const regionPatchSchema = z
  .object({
    name: plainText(60).optional(),
    centerLng: z.number().finite().optional(),
    centerLat: z.number().finite().optional(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    zoom: z.number().int().min(1).max(20).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    active: z.boolean().optional(),
  })
  .strict();
