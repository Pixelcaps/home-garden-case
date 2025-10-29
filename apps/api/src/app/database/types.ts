import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface Database {
  user: UserTable;
  garden: GardenTable;
  plant: PlantTable;
}

export interface UserTable {
  userId: Generated<string>;
  firstName: string;
  lastName: string | null;
  age: number | null;
  emailAddress: string;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface GardenTable {
  gardenId: Generated<string>;
  gardenName: string;
  totalSurfaceArea: number; // in square meters
  locationDescription: string | null; // e.g., "Backyard", "Patio"
  latitude: number | null; // optional geographic coordinate
  longitude: number | null; // optional geographic coordinate
}

export type Garden = Selectable<GardenTable>;
export type NewGarden = Insertable<GardenTable>;
export type GardenUpdate = Updateable<GardenTable>;

export interface PlantTable {
  plantId: Generated<string>;
  plantName: string;
  species: string;
  plantType: 'vegetable' | 'fruit' | 'flower';
  plantationDate: ColumnType<Date, string | undefined, never>;
  surfaceAreaRequired: number; // in square meters
  idealHumidityLevel: number;
  gardenId: string; // foreign key to Garden
}

export type Plant = Selectable<PlantTable>;
export type NewPlant = Insertable<PlantTable>;
export type PlantUpdate = Updateable<PlantTable>;
