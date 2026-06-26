/**
 * Maximum allowed gap (in percentage points) between a garden's target humidity
 * and a plant's ideal humidity level. A plant fits a garden when
 * |garden.targetHumidity - plant.idealHumidityLevel| <= MAX_HUMIDITY_DELTA.
 */
export const MAX_HUMIDITY_DELTA = 15;
