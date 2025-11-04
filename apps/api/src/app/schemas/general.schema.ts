import { z } from 'zod/v4';

export const emptyResponseSchema = z.null();

z.globalRegistry.add(emptyResponseSchema, { id: 'EmptyResponse' });
