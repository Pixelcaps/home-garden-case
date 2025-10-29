import { z } from 'zod';

export const createGardenSchema = z
  .object({
    gardenName: z.string().min(1, 'Garden name is required').trim(),
    totalSurfaceArea: z.number().nonnegative('Total surface area must be a non-negative number'),
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
  })
  .refine(
    (data) => {
      const hasLat = data.latitude !== null && data.latitude !== undefined;
      const hasLng = data.longitude !== null && data.longitude !== undefined;
      // Both must be provided together or neither
      return hasLat === hasLng;
    },
    {
      message: 'Both latitude and longitude must be provided together',
    },
  );

export const updateGardenSchema = z
  .object({
    gardenName: z.string().min(1, 'Garden name is required').trim().optional(),
    totalSurfaceArea: z
      .number()
      .nonnegative('Total surface area must be a non-negative number')
      .optional(),
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
  })
  .refine(
    (data) => {
      const hasLat = data.latitude !== null && data.latitude !== undefined;
      const hasLng = data.longitude !== null && data.longitude !== undefined;
      // Both must be provided together or neither
      return hasLat === hasLng;
    },
    {
      message: 'Both latitude and longitude must be provided together',
    },
  );

export const gardenIdParamsSchema = z.object({
  gardenId: z.number().int().positive('Garden ID must be a positive integer'),
});

export const searchGardenQuerySchema = z.object({
  name: z.string().min(1, 'Name query parameter is required'),
});
