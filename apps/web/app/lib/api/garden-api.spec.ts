import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./resilient-fetch', () => ({
  resilientFetch: vi.fn().mockResolvedValue({ ok: true }),
  invalidateCache: vi.fn(),
}));
vi.mock('./config', () => ({
  apiConfig: { baseUrl: 'http://api.test', bearerToken: 'tok', defaultUserId: 1 },
}));

import { resilientFetch, invalidateCache } from './resilient-fetch';
import {
  getGardensByUser,
  getGarden,
  getPlantsByGarden,
  createGarden,
  deletePlant,
} from './garden-api';

const mockFetch = vi.mocked(resilientFetch);
const mockInvalidate = vi.mocked(invalidateCache);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('garden-api', () => {
  it('getGardensByUser GETs the nested user path with base url and token', async () => {
    await getGardensByUser(1);
    expect(mockFetch).toHaveBeenCalledWith('/gardens/user/1', {
      baseUrl: 'http://api.test',
      token: 'tok',
    });
  });

  it('getGarden GETs the garden by id', async () => {
    await getGarden(7);
    expect(mockFetch).toHaveBeenCalledWith('/gardens/7', {
      baseUrl: 'http://api.test',
      token: 'tok',
    });
  });

  it('getPlantsByGarden GETs the plants-by-garden path', async () => {
    await getPlantsByGarden(7);
    expect(mockFetch).toHaveBeenCalledWith('/plants/garden/7', {
      baseUrl: 'http://api.test',
      token: 'tok',
    });
  });

  it('createGarden POSTs the body and invalidates the cache', async () => {
    const input = {
      gardenName: 'G',
      totalSurfaceArea: 10,
      targetHumidity: 50,
      userId: 1,
    };
    await createGarden(input);
    expect(mockFetch).toHaveBeenCalledWith('/gardens', {
      baseUrl: 'http://api.test',
      token: 'tok',
      method: 'POST',
      body: input,
    });
    expect(mockInvalidate).toHaveBeenCalledOnce();
  });

  it('deletePlant DELETEs by id and invalidates the cache', async () => {
    await deletePlant(3);
    expect(mockFetch).toHaveBeenCalledWith('/plants/3', {
      baseUrl: 'http://api.test',
      token: 'tok',
      method: 'DELETE',
      body: undefined,
    });
    expect(mockInvalidate).toHaveBeenCalledOnce();
  });
});
