import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../lib/api/resilient-fetch';

vi.mock('../lib/api/config', () => ({ apiConfig: { defaultUserId: 1 } }));
vi.mock('../lib/api/garden-api', () => ({
  createGarden: vi.fn(),
  updateGarden: vi.fn(),
  deleteGarden: vi.fn(),
  createPlant: vi.fn(),
  updatePlant: vi.fn(),
  deletePlant: vi.fn(),
}));

import * as api from '../lib/api/garden-api';
import { action as gardensAction } from './gardens';
import { action as detailAction } from './garden-detail';

function request(fields: Record<string, string>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return { formData: async () => form } as unknown as Request;
}

beforeEach(() => vi.clearAllMocks());

describe('gardens action', () => {
  it('creates a garden for the default user', async () => {
    vi.mocked(api.createGarden).mockResolvedValue({} as never);
    const result = await gardensAction({
      request: request({ intent: 'create-garden', gardenName: 'P', totalSurfaceArea: '20', targetHumidity: '65' }),
    });
    expect(api.createGarden).toHaveBeenCalledWith(expect.objectContaining({ gardenName: 'P', userId: 1 }));
    expect(result).toEqual({ ok: true });
  });
});

describe('garden-detail action', () => {
  it('surfaces a server overcrowding/humidity 4xx as an inline error', async () => {
    vi.mocked(api.createPlant).mockRejectedValue(
      new ApiError(400, JSON.stringify({ error: 'Validation error', details: ['Cannot add plant: would exceed area'] })),
    );
    const result = await detailAction({
      request: request({ intent: 'create-plant', plantName: 'X', species: 'Y', plantType: 'vegetable', plantationDate: '2026-06-26', surfaceAreaRequired: '99', idealHumidityLevel: '60' }),
      params: { gardenId: '7' },
    } as never);
    expect(result).toEqual({ error: 'Cannot add plant: would exceed area' });
  });

  it('redirects after deleting a garden', async () => {
    vi.mocked(api.deleteGarden).mockResolvedValue(undefined);
    const result = await detailAction({
      request: request({ intent: 'delete-garden' }),
      params: { gardenId: '7' },
    } as never);
    expect(api.deleteGarden).toHaveBeenCalledWith(7);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });

  it('deletes a plant by id', async () => {
    vi.mocked(api.deletePlant).mockResolvedValue(undefined);
    const result = await detailAction({
      request: request({ intent: 'delete-plant', plantId: '3' }),
      params: { gardenId: '7' },
    } as never);
    expect(api.deletePlant).toHaveBeenCalledWith(3);
    expect(result).toEqual({ ok: true });
  });

  it('update-garden', async () => {
    vi.mocked(api.updateGarden).mockResolvedValue({} as never);
    const result = await detailAction({
      request: request({ intent: 'update-garden', gardenName: 'New', totalSurfaceArea: '15', targetHumidity: '50' }),
      params: { gardenId: '7' },
    } as never);
    expect(api.updateGarden).toHaveBeenCalledWith(7, expect.objectContaining({ gardenName: 'New' }));
    expect(api.updateGarden).toHaveBeenCalledWith(7, expect.not.objectContaining({ userId: expect.anything() }));
    expect(result).toEqual({ ok: true });
  });

  it('update-plant', async () => {
    vi.mocked(api.updatePlant).mockResolvedValue({} as never);
    const result = await detailAction({
      request: request({ intent: 'update-plant', plantId: '3', plantName: 'P', species: 'S', plantType: 'fruit', plantationDate: '2026-06-26', surfaceAreaRequired: '1', idealHumidityLevel: '55' }),
      params: { gardenId: '7' },
    } as never);
    expect(api.updatePlant).toHaveBeenCalledWith(3, expect.objectContaining({ gardenId: 7, plantType: 'fruit' }));
    expect(result).toEqual({ ok: true });
  });
});
