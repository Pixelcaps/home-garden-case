import { Plant } from './types';

/**
 * Maximum allowed gap (percentage points) between a garden's target humidity
 * and a plant's ideal humidity. Mirrors the API's MAX_HUMIDITY_DELTA.
 */
export const MAX_HUMIDITY_DELTA = 15;

export interface AreaCheck {
  used: number;
  remaining: number;
  total: number;
  requested: number;
  projected: number;
  fits: boolean;
  overBy: number;
}

export interface HumidityCheck {
  ok: boolean;
  target: number;
  ideal: number;
  min: number;
  max: number;
  delta: number;
}

export function usedArea(plants: Pick<Plant, 'surfaceAreaRequired'>[]): number {
  return plants.reduce((sum, p) => sum + p.surfaceAreaRequired, 0);
}

export function checkArea(
  totalSurfaceArea: number,
  existingPlants: Plant[],
  requestedArea: number,
  excludePlantId?: number,
): AreaCheck {
  const used = usedArea(existingPlants.filter((p) => p.plantId !== excludePlantId));
  const projected = used + requestedArea;
  return {
    used,
    remaining: totalSurfaceArea - used,
    total: totalSurfaceArea,
    requested: requestedArea,
    projected,
    fits: projected <= totalSurfaceArea,
    overBy: Math.max(0, projected - totalSurfaceArea),
  };
}

export function humidityBand(targetHumidity: number): { min: number; max: number } {
  return { min: targetHumidity - MAX_HUMIDITY_DELTA, max: targetHumidity + MAX_HUMIDITY_DELTA };
}

export function checkHumidity(targetHumidity: number, idealHumidity: number): HumidityCheck {
  const { min, max } = humidityBand(targetHumidity);
  const delta = Math.abs(targetHumidity - idealHumidity);
  return { ok: delta <= MAX_HUMIDITY_DELTA, target: targetHumidity, ideal: idealHumidity, min, max, delta };
}
