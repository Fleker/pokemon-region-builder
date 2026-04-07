export type MapStyle = 'rs' | 'dp';
export type LayerType = 'background' | 'water' | 'terrain' | 'path' | 'landmark';
export type LandmarkType = 'city' | 'town' | 'route' | 'cave' | 'special';

/** Sub-cells per grid cell in each dimension for the terrain layer. */
export const TERRAIN_SCALE = 4;

export interface MapCell {
  water: boolean;
  /** Legacy per-cell terrain. New saves use terrainGrid instead; kept for migration. */
  terrain: number;
  path: boolean;
  landmarkId: string | null;
}

export interface Landmark {
  id: string;
  x: number; // column (left edge)
  y: number; // row (top edge)
  width: 1 | 2;
  height: 1 | 2;
  type: LandmarkType;
  name: string;
  description: string;
  pokemon: string[];
}

export interface BackgroundTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number; // degrees
}

export interface MapData {
  style: MapStyle;
  width: number;
  height: number;
  background: string | null;
  backgroundTransform: BackgroundTransform;
  cells: MapCell[][];
  landmarks: Landmark[];
  /**
   * High-resolution terrain grid at TERRAIN_SCALE× the cell grid.
   * Flat array of size (width * TERRAIN_SCALE) * (height * TERRAIN_SCALE).
   * Values: -1 = empty, 0-4 = terrain type.
   * null means no terrain has been painted yet.
   */
  terrainGrid: number[] | null;
}

export function createEmptyCell(): MapCell {
  return { water: false, terrain: -1, path: false, landmarkId: null };
}

export function createDefaultMap(width: number, height: number, style: MapStyle = 'rs'): MapData {
  const cells: MapCell[][] = [];
  for (let row = 0; row < height; row++) {
    cells[row] = [];
    for (let col = 0; col < width; col++) {
      cells[row][col] = createEmptyCell();
    }
  }
  return {
    style,
    width,
    height,
    background: null,
    backgroundTransform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0 },
    cells,
    landmarks: [],
    terrainGrid: null,
  };
}

/** Create a blank terrain grid for a map. */
export function createTerrainGrid(width: number, height: number): number[] {
  return new Array(width * TERRAIN_SCALE * height * TERRAIN_SCALE).fill(-1);
}

/**
 * If the map still has legacy per-cell terrain data (terrainGrid === null),
 * upscale it to the sub-cell grid and return an updated map.
 */
export function migrateTerrainToGrid(map: MapData): MapData {
  if (map.terrainGrid !== null && map.terrainGrid !== undefined) return map;

  const scale = TERRAIN_SCALE;
  const gW = map.width * scale;
  const grid = createTerrainGrid(map.width, map.height);
  let hasTerrain = false;

  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const t = map.cells[row]?.[col]?.terrain ?? -1;
      if (t >= 0) {
        hasTerrain = true;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            grid[(row * scale + dy) * gW + (col * scale + dx)] = t;
          }
        }
      }
    }
  }

  return { ...map, terrainGrid: hasTerrain ? grid : null };
}

export const TERRAIN_LABELS = ['Light Grass', 'Medium Grass', 'Dark Grass', 'Forest', 'Mountain'];

export const TERRAIN_COLORS: Record<MapStyle, string[]> = {
  rs: ['#96d454', '#7dc23d', '#4c8505', '#64a726', '#906040'],
  dp: ['#87c846', '#59900e', '#6fad2e', '#6eaf2f', '#906040'],
};

/** Pre-parsed RGB values for fast ImageData writes (avoids hex parsing at render time). */
export const TERRAIN_RGB: Record<MapStyle, [number, number, number][]> = {
  rs: [
    [150, 212, 84],
    [125, 194, 61],
    [76, 133, 5],
    [100, 167, 38],
    [144, 96, 64],
  ],
  dp: [
    [135, 200, 70],
    [89, 144, 14],
    [111, 173, 46],
    [110, 175, 47],
    [144, 96, 64],
  ],
};

export const WATER_COLORS: Record<MapStyle, string> = {
  rs: '#26a7c2',
  dp: '#3fc8d8',
};

export const PATH_COLORS: Record<MapStyle, string> = {
  rs: '#f7a735cc', // With transparency
  dp: '#f7c856cc',
};

export const DEFAULT_BG_COLORS: Record<MapStyle, string> = {
  rs: '#859618',
  dp: '#8fa020',
};

export const LANDMARK_TYPE_LABELS: Record<LandmarkType, string> = {
  city: 'City',
  town: 'Town',
  route: 'Route',
  cave: 'Cave',
  special: 'Special',
};
