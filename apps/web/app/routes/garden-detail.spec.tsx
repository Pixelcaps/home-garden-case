import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Garden, Plant } from '@itp-home-garden/shared';

vi.mock('../lib/api/garden-api', () => ({
  getGarden: vi.fn(),
  getPlantsByGarden: vi.fn(),
}));

import { getGarden, getPlantsByGarden } from '../lib/api/garden-api';
import { loader } from './garden-detail';

const garden: Garden = {
  gardenId: 7,
  gardenName: 'G7',
  totalSurfaceArea: 20,
  targetHumidity: 60,
  locationDescription: 'Backyard',
  latitude: null,
  longitude: null,
  userId: 1,
  createdAt: '',
  updatedAt: '',
};
const plant: Plant = {
  plantId: 1,
  plantName: 'Tomato',
  species: 'Solanum lycopersicum',
  plantType: 'vegetable',
  plantationDate: '',
  surfaceAreaRequired: 3,
  idealHumidityLevel: 60,
  gardenId: 7,
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => vi.clearAllMocks());

describe('garden-detail loader', () => {
  it('loads the garden and its plants by id from the route param', async () => {
    vi.mocked(getGarden).mockResolvedValue(garden);
    vi.mocked(getPlantsByGarden).mockResolvedValue([plant]);

    const result = await loader({ params: { gardenId: '7' } } as never);

    expect(getGarden).toHaveBeenCalledWith(7);
    expect(getPlantsByGarden).toHaveBeenCalledWith(7);
    expect(result.garden.gardenId).toBe(7);
    expect(result.plants).toHaveLength(1);
  });
});
