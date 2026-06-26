import type { Garden, Plant, PlantType } from '@itp-home-garden/shared';
import { apiConfig } from './config';
import { invalidateCache, resilientFetch } from './resilient-fetch';

export interface GardenInput {
  gardenName: string;
  totalSurfaceArea: number;
  targetHumidity: number;
  locationDescription?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  userId: number;
}

export type GardenUpdateInput = Omit<GardenInput, 'userId'>;

export interface PlantInput {
  plantName: string;
  species: string;
  plantType: PlantType;
  plantationDate: string;
  surfaceAreaRequired: number;
  idealHumidityLevel: number;
  gardenId: number;
}

function readOptions() {
  return { baseUrl: apiConfig.baseUrl, token: apiConfig.bearerToken };
}

async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  const result = await resilientFetch<T>(path, { ...readOptions(), method, body });
  invalidateCache();
  return result;
}

export function getGardensByUser(userId: number): Promise<Garden[]> {
  return resilientFetch<Garden[]>(`/gardens/user/${userId}`, readOptions());
}

export function getGarden(gardenId: number): Promise<Garden> {
  return resilientFetch<Garden>(`/gardens/${gardenId}`, readOptions());
}

export function getPlantsByGarden(gardenId: number): Promise<Plant[]> {
  return resilientFetch<Plant[]>(`/plants/garden/${gardenId}`, readOptions());
}

export function createGarden(input: GardenInput): Promise<Garden> {
  return mutate<Garden>('/gardens', 'POST', input);
}

export function updateGarden(gardenId: number, input: GardenUpdateInput): Promise<Garden> {
  return mutate<Garden>(`/gardens/${gardenId}`, 'PUT', input);
}

export function deleteGarden(gardenId: number): Promise<void> {
  return mutate<void>(`/gardens/${gardenId}`, 'DELETE');
}

export function createPlant(input: PlantInput): Promise<Plant> {
  return mutate<Plant>('/plants', 'POST', input);
}

export function updatePlant(plantId: number, input: PlantInput): Promise<Plant> {
  return mutate<Plant>(`/plants/${plantId}`, 'PUT', input);
}

export function deletePlant(plantId: number): Promise<void> {
  return mutate<void>(`/plants/${plantId}`, 'DELETE');
}
