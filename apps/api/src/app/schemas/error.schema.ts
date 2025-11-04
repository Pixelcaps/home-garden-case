import { z } from 'zod/v4';

export const validationErrorResponseSchema = z.object({
  error: z.string(),
  details: z.union([z.array(z.string()), z.object({}).loose()]),
});

z.globalRegistry.add(validationErrorResponseSchema, { id: 'ValidationErrorResponse' });

export const notFoundErrorResponseSchema = z.object({
  error: z.string(),
  details: z.union([z.array(z.string()), z.object({}).loose()]),
});

z.globalRegistry.add(notFoundErrorResponseSchema, { id: 'NotFoundErrorResponse' });

export const conflictErrorResponseSchema = z.object({
  error: z.string(),
  details: z.union([z.array(z.string()), z.object({}).loose()]),
});

z.globalRegistry.add(conflictErrorResponseSchema, { id: 'ConflictErrorResponse' });

export const internalServerErrorResponseSchema = z.object({
  error: z.string(),
  details: z.union([z.array(z.string()), z.object({}).loose()]),
});

z.globalRegistry.add(internalServerErrorResponseSchema, { id: 'InternalServerErrorResponse' });
