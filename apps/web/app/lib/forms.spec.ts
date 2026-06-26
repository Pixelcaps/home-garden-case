import { describe, it, expect } from 'vitest';
import { ApiError } from './api/resilient-fetch';
import {
  gardenInputFromForm,
  plantInputFromForm,
  actionError,
} from './forms';

function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

describe('gardenInputFromForm', () => {
  it('parses numbers and coerces empty optionals to null, attaching userId', () => {
    const input = gardenInputFromForm(
      fd({ gardenName: 'Patch', totalSurfaceArea: '20', targetHumidity: '65', locationDescription: '', latitude: '', longitude: '' }),
      1,
    );
    expect(input).toEqual({
      gardenName: 'Patch',
      totalSurfaceArea: 20,
      targetHumidity: 65,
      locationDescription: null,
      latitude: null,
      longitude: null,
      userId: 1,
    });
  });
});

describe('plantInputFromForm', () => {
  it('parses a plant and converts the date to ISO, attaching gardenId', () => {
    const input = plantInputFromForm(
      fd({ plantName: 'Basil', species: 'Ocimum basilicum', plantType: 'vegetable', plantationDate: '2026-06-26', surfaceAreaRequired: '1.5', idealHumidityLevel: '60' }),
      7,
    );
    expect(input.plantName).toBe('Basil');
    expect(input.plantType).toBe('vegetable');
    expect(input.surfaceAreaRequired).toBe(1.5);
    expect(input.idealHumidityLevel).toBe(60);
    expect(input.gardenId).toBe(7);
    expect(input.plantationDate).toBe('2026-06-26T00:00:00.000Z');
  });
});

describe('actionError', () => {
  it('extracts the details message from a 4xx ApiError body', () => {
    const err = new ApiError(400, JSON.stringify({ error: 'Validation error', details: ['Cannot add plant: too humid'] }));
    expect(actionError(err)).toEqual({ error: 'Cannot add plant: too humid' });
  });

  it('returns a busy message for a 5xx ApiError', () => {
    expect(actionError(new ApiError(500, 'Server error 500'))).toEqual({
      error: 'The garden service is busy right now. Please try again.',
    });
  });

  it('returns a generic message for a non-ApiError', () => {
    expect(actionError(new Error('boom'))).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});
