import { z } from 'zod/v4';

export const createPlantSchema = z.object({
  plantName: z.string().min(1, 'Plant name is required').trim(),
  species: z.string().min(1, 'Species is required').trim(),
  plantType: z.enum(['vegetable', 'fruit', 'flower'], {
    message: 'Plant type must be vegetable, fruit, or flower',
  }),
  plantationDate: z
    .union([z.iso.datetime(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  surfaceAreaRequired: z
    .number()
    .nonnegative('Surface area required must be a non-negative number'),
  idealHumidityLevel: z
    .number()
    .min(0, 'Ideal humidity level must be between 0 and 100')
    .max(100, 'Ideal humidity level must be between 0 and 100'),
  gardenId: z.number().int().positive('Garden ID must be a positive integer'),
});

export const updatePlantSchema = z.object({
  plantName: z.string().min(1, 'Plant name is required').trim().optional(),
  species: z.string().min(1, 'Species is required').trim().optional(),
  plantType: z
    .enum(['vegetable', 'fruit', 'flower'], {
      message: 'Plant type must be vegetable, fruit, or flower',
    })
    .optional(),
  plantationDate: z
    .union([z.iso.datetime(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val))
    .optional(),
  surfaceAreaRequired: z
    .number()
    .nonnegative('Surface area required must be a non-negative number')
    .optional(),
  idealHumidityLevel: z
    .number()
    .min(0, 'Ideal humidity level must be between 0 and 100')
    .max(100, 'Ideal humidity level must be between 0 and 100')
    .optional(),
  gardenId: z.number().int().positive('Garden ID must be a positive integer').optional(),
});

export const plantIdParamsSchema = z.object({
  plantId: z.number().int().positive('Plant ID must be a positive integer'),
});

export const gardenIdParamsSchema = z.object({
  gardenId: z.number().int().positive('Garden ID must be a positive integer'),
});

export const plantTypeParamsSchema = z.object({
  plantType: z.enum(['vegetable', 'fruit', 'flower'], {
    message: 'Invalid plant type. Must be vegetable, fruit, or flower',
  }),
});

export const speciesParamsSchema = z.object({
  species: z.string().transform((val) => decodeURIComponent(val)),
});
