import { describe, it, expect } from 'vitest';
import { Plant } from './types';
import { MAX_HUMIDITY_DELTA, usedArea, checkArea, humidityBand, checkHumidity } from './capacity';

const plant = (plantId: number, surfaceAreaRequired: number): Plant => ({
  plantId,
  plantName: `p${plantId}`,
  species: 's',
  plantType: 'vegetable',
  plantationDate: '2026-06-26T00:00:00.000Z',
  surfaceAreaRequired,
  idealHumidityLevel: 50,
  gardenId: 1,
  createdAt: '',
  updatedAt: '',
});

describe('usedArea', () => {
  it('sums the surface area of plants', () => {
    expect(usedArea([plant(1, 3), plant(2, 1.5)])).toBe(4.5);
  });
  it('is 0 for no plants', () => {
    expect(usedArea([])).toBe(0);
  });
});

describe('checkArea', () => {
  it('fits when projected total is below capacity', () => {
    const r = checkArea(20, [plant(1, 12.5)], 5);
    expect(r).toMatchObject({ used: 12.5, projected: 17.5, remaining: 7.5, fits: true, overBy: 0 });
  });
  it('fits exactly at capacity (inclusive)', () => {
    const r = checkArea(20, [plant(1, 15)], 5);
    expect(r.fits).toBe(true);
    expect(r.overBy).toBe(0);
  });
  it('does not fit when projected exceeds capacity', () => {
    const r = checkArea(20, [plant(1, 12.5)], 10);
    expect(r.fits).toBe(false);
    expect(r.projected).toBe(22.5);
    expect(r.overBy).toBe(2.5);
  });
  it('excludes the edited plant from used area', () => {
    const r = checkArea(20, [plant(1, 12.5), plant(2, 5)], 6, 2);
    expect(r.used).toBe(12.5);
    expect(r.fits).toBe(true);
  });
});

describe('humidityBand', () => {
  it('is target +/- MAX_HUMIDITY_DELTA', () => {
    expect(humidityBand(65)).toEqual({ min: 50, max: 80 });
    expect(MAX_HUMIDITY_DELTA).toBe(15);
  });
});

describe('checkHumidity', () => {
  it('is ok inside the band', () => {
    expect(checkHumidity(65, 60).ok).toBe(true);
  });
  it('is ok exactly at the band edge (inclusive)', () => {
    expect(checkHumidity(65, 80).ok).toBe(true);
    expect(checkHumidity(65, 50).ok).toBe(true);
  });
  it('is not ok outside the band', () => {
    const r = checkHumidity(65, 85);
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ min: 50, max: 80, delta: 20 });
  });
});
