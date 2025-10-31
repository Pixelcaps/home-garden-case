export const validationErrorResponse = {
  description: 'Validation error',
  type: 'object',
  properties: {
    error: { type: 'string' },
    details: { type: ['array', 'object'] },
  },
};

export const notFoundErrorResponse = (itemName: string) => ({
  description: `${itemName} not found`,
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
});

export const conflictErrorResponse = (itemName: string) => ({
  description: `${itemName} already exists`,
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
});

export const internalServerErrorResponse = {
  description: 'Internal server error',
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
};
