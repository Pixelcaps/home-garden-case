import { z } from 'zod/v4';

export const userIdParamsSchema = z.object({
  userId: z.coerce.number().int().positive('User ID must be a positive integer'),
});

z.globalRegistry.add(userIdParamsSchema, { id: 'UserId' });

export const emailParamsSchema = z.object({
  emailAddress: z
    .email('Invalid email address format')
    .min(1, 'Email address is required')
    .trim()
    .toLowerCase(),
});

z.globalRegistry.add(emailParamsSchema, { id: 'Email' });

export const createUserSchema = z.object({
  firstName: z.string().trim().nullable().optional(),
  lastName: z.string().nullable().optional(),
  age: z.number().int().positive('Age must be a positive integer').nullable().optional(),
  emailAddress: z
    .email('Invalid email address format')
    .min(1, 'Email address is required')
    .trim()
    .toLowerCase(),
});

z.globalRegistry.add(createUserSchema, { id: 'CreateUser' });

export const updateUserSchema = createUserSchema;

z.globalRegistry.add(updateUserSchema, { id: 'UpdateUser' });

export const userResponseSchema = createUserSchema.safeExtend({
  userId: z.number(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
});

z.globalRegistry.add(userResponseSchema, { id: 'User' });

export const usersResponseSchema = z.array(userResponseSchema);
z.globalRegistry.add(usersResponseSchema, { id: 'Users' });
