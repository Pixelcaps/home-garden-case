import { z } from 'zod';

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

export const updateUserSchema = z.object({
  firstName: z.string().trim().nullable().optional(),
  lastName: z.string().nullable().optional(),
  age: z.number().int().positive('Age must be a positive integer').nullable().optional(),
  emailAddress: z
    .email('Invalid email address format')
    .min(1, 'Email address is required')
    .trim()
    .toLowerCase()
    .optional(),
});

export const userIdParamsSchema = z.object({
  userId: z
    .string()
    .refine((val) => !isNaN(parseInt(val, 10)), {
      message: 'Invalid user ID: must be a number',
    })
    .transform((val) => parseInt(val, 10)),
});

export const emailParamsSchema = z.object({
  emailAddress: z.string().transform((val) => decodeURIComponent(val)),
});
