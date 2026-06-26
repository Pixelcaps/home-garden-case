import type { PlantType } from '@itp-home-garden/shared';
import type { GardenInput, GardenUpdateInput, PlantInput } from './api/garden-api';
import { ApiError } from './api/resilient-fetch';

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}
function num(form: FormData, key: string): number {
  return Number(form.get(key));
}
function optStr(form: FormData, key: string): string | null {
  const value = str(form, key);
  return value === '' ? null : value;
}
function optNum(form: FormData, key: string): number | null {
  const value = str(form, key);
  return value === '' ? null : Number(value);
}

function gardenFields(form: FormData) {
  return {
    gardenName: str(form, 'gardenName'),
    totalSurfaceArea: num(form, 'totalSurfaceArea'),
    targetHumidity: num(form, 'targetHumidity'),
    locationDescription: optStr(form, 'locationDescription'),
    latitude: optNum(form, 'latitude'),
    longitude: optNum(form, 'longitude'),
  };
}

export function gardenInputFromForm(form: FormData, userId: number): GardenInput {
  return { ...gardenFields(form), userId };
}

export function gardenUpdateFromForm(form: FormData): GardenUpdateInput {
  return gardenFields(form);
}

export function plantInputFromForm(form: FormData, gardenId: number): PlantInput {
  return {
    plantName: str(form, 'plantName'),
    species: str(form, 'species'),
    plantType: str(form, 'plantType') as PlantType,
    plantationDate: new Date(str(form, 'plantationDate')).toISOString(),
    surfaceAreaRequired: num(form, 'surfaceAreaRequired'),
    idealHumidityLevel: num(form, 'idealHumidityLevel'),
    gardenId,
  };
}

export function actionError(err: unknown): { error: string } {
  if (!(err instanceof ApiError)) {
    return { error: 'Something went wrong. Please try again.' };
  }
  if (err.status >= 500) {
    return { error: 'The garden service is busy right now. Please try again.' };
  }
  try {
    const body = JSON.parse(err.message);
    const message = Array.isArray(body.details) ? body.details.join(', ') : body.error;
    return { error: message || err.message };
  } catch {
    return { error: err.message };
  }
}
