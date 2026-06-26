export type PlantType = 'vegetable' | 'fruit' | 'flower';

export interface Garden {
  gardenId: number;
  gardenName: string;
  totalSurfaceArea: number;
  targetHumidity: number;
  locationDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Plant {
  plantId: number;
  plantName: string;
  species: string;
  plantType: PlantType;
  plantationDate: string;
  surfaceAreaRequired: number;
  idealHumidityLevel: number;
  gardenId: number;
  createdAt: string;
  updatedAt: string;
}
