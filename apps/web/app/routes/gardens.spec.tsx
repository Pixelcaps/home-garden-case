import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Garden, Plant } from '@itp-home-garden/shared';

vi.mock('../lib/api/config', () => ({ apiConfig: { defaultUserId: 1 } }));
vi.mock('../lib/api/garden-api', () => ({
  getGardensByUser: vi.fn(),
  getPlantsByGarden: vi.fn(),
}));

import { getGardensByUser, getPlantsByGarden } from '../lib/api/garden-api';
import { loader } from './gardens';

const garden = (gardenId: number, totalSurfaceArea: number): Garden => ({
  gardenId,
  gardenName: `G${gardenId}`,
  totalSurfaceArea,
  targetHumidity: 60,
  locationDescription: null,
  latitude: null,
  longitude: null,
  userId: 1,
  createdAt: '',
  updatedAt: '',
});

const plant = (plantId: number, gardenId: number, area: number): Plant => ({
  plantId,
  plantName: `p${plantId}`,
  species: 's',
  plantType: 'vegetable',
  plantationDate: '',
  surfaceAreaRequired: area,
  idealHumidityLevel: 60,
  gardenId,
  createdAt: '',
  updatedAt: '',
});

beforeEach(() => vi.clearAllMocks());

describe('gardens loader', () => {
  it('aggregates used area and plant count per garden for the default user', async () => {
    vi.mocked(getGardensByUser).mockResolvedValue([garden(1, 20), garden(2, 10)]);
    vi.mocked(getPlantsByGarden).mockImplementation(async (id: number) =>
      id === 1 ? [plant(1, 1, 3), plant(2, 1, 1.5)] : [],
    );

    const result = await loader();

    expect(getGardensByUser).toHaveBeenCalledWith(1);
    expect(result.gardens).toHaveLength(2);
    expect(result.gardens[0]).toMatchObject({ gardenId: 1, usedArea: 4.5, plantCount: 2 });
    expect(result.gardens[1]).toMatchObject({ gardenId: 2, usedArea: 0, plantCount: 0 });
  });

  it('returns an empty list when the user has no gardens', async () => {
    vi.mocked(getGardensByUser).mockResolvedValue([]);
    const result = await loader();
    expect(result.gardens).toEqual([]);
    expect(getPlantsByGarden).not.toHaveBeenCalled();
  });
});
