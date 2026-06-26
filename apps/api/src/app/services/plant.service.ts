import { GardenRepository } from '../database/repositories/garden.repository';
import { PlantRepository } from '../database/repositories/plant.repository';
import { NewPlant, Plant, PlantUpdate } from '../database/types';
import { createPlantSchema, updatePlantSchema } from '../schemas/plant.schema';
import { MAX_HUMIDITY_DELTA } from '../shared/constants';
import { NotFoundError, ValidationError } from '../shared/errors';

export class PlantService {
  private readonly plantRepository: PlantRepository;
  private readonly gardenRepository: GardenRepository;

  constructor(opts: { plantRepository: PlantRepository; gardenRepository: GardenRepository }) {
    this.plantRepository = opts.plantRepository;
    this.gardenRepository = opts.gardenRepository;
  }

  /**
   * Ensure a plant's ideal humidity sits within MAX_HUMIDITY_DELTA of the garden's target.
   * @throws ValidationError if it does not
   */
  private assertHumidityFits(
    targetHumidity: number,
    idealHumidity: number,
    verb: 'add' | 'update',
  ): void {
    if (Math.abs(targetHumidity - idealHumidity) <= MAX_HUMIDITY_DELTA) {
      return;
    }
    throw new ValidationError(
      `Cannot ${verb} plant: ideal humidity (${idealHumidity}%) must be within ` +
        `${MAX_HUMIDITY_DELTA}% of the garden's target humidity (${targetHumidity}%). ` +
        `Allowed range is ${targetHumidity - MAX_HUMIDITY_DELTA}–${targetHumidity + MAX_HUMIDITY_DELTA}%.`,
    );
  }

  /**
   * Get a plant by ID
   * @throws Error if plant not found
   */
  async getPlantById(plantId: number): Promise<Plant> {
    const plant = await this.plantRepository.findById(plantId);
    if (!plant) {
      throw new NotFoundError(`Plant with ID ${plantId} not found`);
    }
    return plant;
  }

  /**
   * Get all plants in a specific garden
   * @throws Error if garden not found
   */
  async getPlantsByGardenId(gardenId: number): Promise<Plant[]> {
    // Verify garden exists
    const garden = await this.gardenRepository.findById(gardenId);
    if (!garden) {
      throw new ValidationError(`Garden with ID ${gardenId} not found`);
    }

    return await this.plantRepository.findByGardenId(gardenId);
  }

  /**
   * Create a new plant
   * @throws Error if validation fails or garden doesn't exist
   */
  async createPlant(data: NewPlant): Promise<Plant> {
    // Validate with Zod schema
    const validatedData = createPlantSchema.parse(data);

    // Verify garden exists
    const garden = await this.gardenRepository.findById(validatedData.gardenId);
    if (!garden) {
      throw new NotFoundError(`Garden with ID ${validatedData.gardenId} not found`);
    }

    // Check humidity compatibility (garden target vs plant ideal)
    this.assertHumidityFits(garden.targetHumidity, validatedData.idealHumidityLevel, 'add');

    // Check if total surface area would be exceeded
    const existingPlants = await this.plantRepository.findByGardenId(validatedData.gardenId);
    const totalUsedArea = existingPlants.reduce((sum, plant) => sum + plant.surfaceAreaRequired, 0);
    const newTotalArea = totalUsedArea + validatedData.surfaceAreaRequired;

    if (newTotalArea > garden.totalSurfaceArea) {
      throw new ValidationError(
        `Cannot add plant: total surface area required (${newTotalArea}m²) would exceed garden's total surface area (${garden.totalSurfaceArea}m²)`,
      );
    }

    return await this.plantRepository.create(validatedData);
  }

  /**
   * Update a plant
   * @throws Error if plant not found, validation fails, or garden doesn't exist
   */
  async updatePlant(plantId: number, data: PlantUpdate): Promise<Plant> {
    // Verify plant exists
    const existingPlant = await this.plantRepository.findById(plantId);
    if (!existingPlant) {
      throw new NotFoundError(`Plant with ID ${plantId} not found`);
    }

    // Validate with Zod schema
    const validatedData = updatePlantSchema.parse(data);

    // If garden is being changed, verify new garden exists
    const targetGardenId = validatedData.gardenId ?? existingPlant.gardenId;
    if (validatedData.gardenId && validatedData.gardenId !== existingPlant.gardenId) {
      const newGarden = await this.gardenRepository.findById(validatedData.gardenId);
      if (!newGarden) {
        throw new ValidationError(`Garden with ID ${validatedData.gardenId} not found`);
      }
    }

    // Check humidity compatibility if humidity or garden is being updated
    if (validatedData.idealHumidityLevel !== undefined || validatedData.gardenId !== undefined) {
      const humidityGarden = await this.gardenRepository.findById(targetGardenId);
      if (!humidityGarden) {
        throw new ValidationError(`Garden with ID ${targetGardenId} not found`);
      }
      const finalHumidity = validatedData.idealHumidityLevel ?? existingPlant.idealHumidityLevel;
      this.assertHumidityFits(humidityGarden.targetHumidity, finalHumidity, 'update');
    }

    // Check surface area constraints if surface area or garden is being updated
    if (validatedData.surfaceAreaRequired !== undefined || validatedData.gardenId !== undefined) {
      const finalSurfaceArea =
        validatedData.surfaceAreaRequired ?? existingPlant.surfaceAreaRequired;

      const garden = await this.gardenRepository.findById(targetGardenId);
      if (!garden) {
        throw new ValidationError(`Garden with ID ${targetGardenId} not found`);
      }

      const existingPlants = await this.plantRepository.findByGardenId(targetGardenId);
      const totalUsedArea = existingPlants
        .filter((p) => p.plantId !== plantId)
        .reduce((sum, plant) => sum + plant.surfaceAreaRequired, 0);
      const newTotalArea = totalUsedArea + finalSurfaceArea;

      if (newTotalArea > garden.totalSurfaceArea) {
        throw new ValidationError(
          `Cannot update plant: total surface area required (${newTotalArea}m²) would exceed garden's total surface area (${garden.totalSurfaceArea}m²)`,
        );
      }
    }

    return await this.plantRepository.update(plantId, validatedData);
  }

  /**
   * Delete a plant
   * @throws Error if plant not found
   */
  async deletePlant(plantId: number): Promise<void> {
    const plant = await this.plantRepository.findById(plantId);
    if (!plant) {
      throw new NotFoundError(`Plant with ID ${plantId} not found`);
    }

    const deleted = await this.plantRepository.delete(plantId);
    if (!deleted) {
      throw new Error(`Failed to delete plant with ID ${plantId}`);
    }
  }
}
