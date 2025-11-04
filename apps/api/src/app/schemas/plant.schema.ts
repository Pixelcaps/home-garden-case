import { z } from 'zod/v4';

export const plantIdParamsSchema = z.object({
  plantId: z.coerce.number().int().positive('Plant ID must be a positive integer'),
});

z.globalRegistry.add(plantIdParamsSchema, { id: 'PlantId' });

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

z.globalRegistry.add(createPlantSchema, { id: 'CreatePlant' });

export const updatePlantSchema = z.intersection(
  createPlantSchema,
  z.object({
    gardenId: z.number().int().positive('Garden ID must be a positive integer').optional(),
  }),
);

z.globalRegistry.add(updatePlantSchema, { id: 'UpdatePlant' });

export const plantResponseSchema = createPlantSchema.safeExtend({
  plantId: z.number(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
});

z.globalRegistry.add(plantResponseSchema, { id: 'Plant' });

export const plantsResponseSchema = z.array(plantResponseSchema);

z.globalRegistry.add(plantsResponseSchema, { id: 'Plants' });
