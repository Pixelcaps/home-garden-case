import { GardenRepository } from '../database/repositories/garden.repository';
import { Garden, GardenUpdate, NewGarden } from '../database/types';
import { createGardenSchema, updateGardenSchema } from '../schemas/garden.schema';

export class GardenService {
  private readonly gardenRepository: GardenRepository;

  constructor(opts: { gardenRepository: GardenRepository }) {
    this.gardenRepository = opts.gardenRepository;
  }

  /**
   * Get all gardens
   */
  async getAllGardens(): Promise<Garden[]> {
    return await this.gardenRepository.findAll();
  }

  /**
   * Get a garden by ID
   * @throws Error if garden not found
   */
  async getGardenById(gardenId: number): Promise<Garden> {
    const garden = await this.gardenRepository.findById(gardenId);
    if (!garden) {
      throw new Error(`Garden with ID ${gardenId} not found`);
    }
    return garden;
  }

  /**
   * Search gardens by name (case-insensitive partial match)
   */
  async searchGardensByName(gardenName: string): Promise<Garden[]> {
    return await this.gardenRepository.findByName(gardenName);
  }

  /**
   * Create a new garden
   * @throws Error if validation fails
   */
  async createGarden(data: NewGarden): Promise<Garden> {
    // Validate with Zod schema
    const validatedData = createGardenSchema.parse(data);

    return await this.gardenRepository.create(validatedData);
  }

  /**
   * Update a garden
   * @throws Error if garden not found or validation fails
   */
  async updateGarden(gardenId: number, data: GardenUpdate): Promise<Garden> {
    // Verify garden exists
    const existingGarden = await this.gardenRepository.findById(gardenId);
    if (!existingGarden) {
      throw new Error(`Garden with ID ${gardenId} not found`);
    }

    // Validate with Zod schema
    const validatedData = updateGardenSchema.parse(data);

    return await this.gardenRepository.update(gardenId, validatedData);
  }

  /**
   * Delete a garden
   * @throws Error if garden not found
   */
  async deleteGarden(gardenId: number): Promise<void> {
    const garden = await this.gardenRepository.findById(gardenId);
    if (!garden) {
      throw new Error(`Garden with ID ${gardenId} not found`);
    }

    const deleted = await this.gardenRepository.delete(gardenId);
    if (!deleted) {
      throw new Error(`Failed to delete garden with ID ${gardenId}`);
    }
  }
}
