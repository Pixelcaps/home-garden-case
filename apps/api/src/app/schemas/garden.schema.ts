import { z } from 'zod/v4';

export const gardenIdParamsSchema = z.object({
  gardenId: z.coerce.number().int().positive('Garden ID must be a positive integer'),
});

z.globalRegistry.add(gardenIdParamsSchema, { id: 'GardenId' });

const gardenObjectSchema = z.object({
  gardenName: z.string().min(1, 'Garden name is required').trim(),
  totalSurfaceArea: z.number().nonnegative('Total surface area must be a non-negative number'),
  targetHumidity: z
    .number()
    .min(0, 'Target humidity must be between 0 and 100')
    .max(100, 'Target humidity must be between 0 and 100'),
  locationDescription: z.string().nullable().optional(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .nullable()
    .optional(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .nullable()
    .optional(),
});

const latitudeLongitudePaired = (data: { latitude?: number | null; longitude?: number | null }) => {
  const hasLat = data.latitude !== null && data.latitude !== undefined;
  const hasLng = data.longitude !== null && data.longitude !== undefined;
  // Both must be provided together or neither
  return hasLat === hasLng;
};

const latitudeLongitudeMessage = {
  message: 'Both latitude and longitude must be provided together',
};

export const createGardenSchema = gardenObjectSchema
  .extend({ userId: z.number().int().positive('User ID must be a positive integer') })
  .refine(latitudeLongitudePaired, latitudeLongitudeMessage);

z.globalRegistry.add(createGardenSchema, { id: 'CreateGarden' });

export const updateGardenSchema = gardenObjectSchema.refine(
  latitudeLongitudePaired,
  latitudeLongitudeMessage,
);

z.globalRegistry.add(updateGardenSchema, { id: 'UpdateGarden' });

export const gardenResponseSchema = gardenObjectSchema.extend({
  gardenId: z.number(),
  userId: z.number(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
});

z.globalRegistry.add(gardenResponseSchema, { id: 'Garden' });

export const gardensResponseSchema = z.array(gardenResponseSchema);

z.globalRegistry.add(gardensResponseSchema, { id: 'Gardens' });
