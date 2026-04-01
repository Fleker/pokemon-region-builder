import { Injectable, signal } from '@angular/core';
import {
  MapData, Landmark, MapCell, createDefaultMap, createEmptyCell,
  TERRAIN_SCALE, createTerrainGrid, migrateTerrainToGrid,
} from '../models/map.model';
import {
  PokedexEntry, CustomPokemon, CustomMove, CustomAbility,
  RegionData, generateId,
} from '../models/pokemon.model';

const AUTOSAVE_KEY = 'pkmn-regions-autosave';

@Injectable({ providedIn: 'root' })
export class RegionStateService {
  regionName = signal('My Region');
  mapData = signal<MapData>(createDefaultMap(80, 60, 'rs'));
  pokedex = signal<PokedexEntry[]>([]);
  customPokemon = signal<CustomPokemon[]>([]);
  customMoves = signal<CustomMove[]>([]);
  customAbilities = signal<CustomAbility[]>([]);
  hasUnsavedChanges = signal(false);

  constructor() {
    this.loadAutosave();
  }

  // ─── Region lifecycle ─────────────────────────────────────────────────────

  createNewRegion(name: string, width: number, height: number, style: 'rs' | 'dp') {
    this.regionName.set(name);
    this.mapData.set(createDefaultMap(width, height, style));
    this.pokedex.set([]);
    this.customPokemon.set([]);
    this.customMoves.set([]);
    this.customAbilities.set([]);
    this.hasUnsavedChanges.set(false);
    this.autosave();
  }

  loadRegion(data: RegionData) {
    this.regionName.set(data.name);
    this.mapData.set(migrateTerrainToGrid(data.mapData));
    this.pokedex.set(data.pokedex);
    this.customPokemon.set(data.customPokemon || []);
    this.customMoves.set(data.customMoves || []);
    this.customAbilities.set(data.customAbilities || []);
    this.hasUnsavedChanges.set(false);
    this.autosave();
  }

  getRegionData(): RegionData {
    return {
      version: 1,
      name: this.regionName(),
      mapData: this.mapData(),
      pokedex: this.pokedex(),
      customPokemon: this.customPokemon(),
      customMoves: this.customMoves(),
      customAbilities: this.customAbilities(),
    };
  }

  private autosave() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.getRegionData()));
    } catch { /* storage full or unavailable */ }
  }

  private loadAutosave() {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return;
    try {
      const data: RegionData = JSON.parse(raw);
      if (data.version === 1) this.loadRegion(data);
    } catch { /* corrupt data, ignore */ }
  }

  setRegionName(name: string) {
    this.regionName.set(name);
    this.markDirty();
  }

  // ─── Map mutations ────────────────────────────────────────────────────────

  private markDirty() {
    this.hasUnsavedChanges.set(true);
    this.autosave();
  }

  updateMap(updater: (map: MapData) => MapData) {
    this.mapData.update(updater);
    this.markDirty();
  }

  setMapStyle(style: 'rs' | 'dp') {
    this.updateMap(m => ({ ...m, style }));
  }

  resizeMap(newWidth: number, newHeight: number) {
    this.updateMap(map => {
      const oldGW = map.width * TERRAIN_SCALE;
      const newGW = newWidth * TERRAIN_SCALE;
      const newGH = newHeight * TERRAIN_SCALE;
      const minGW = Math.min(oldGW, newGW);
      const minGH = Math.min(map.height * TERRAIN_SCALE, newGH);

      // Landmarks that fit in new bounds
      const keptIds = new Set(
        map.landmarks
          .filter(lm => lm.x + lm.width <= newWidth && lm.y + lm.height <= newHeight)
          .map(lm => lm.id),
      );
      const landmarks = map.landmarks.filter(lm => keptIds.has(lm.id));

      // Resize cells
      const cells: MapCell[][] = Array.from({ length: newHeight }, (_, r) =>
        Array.from({ length: newWidth }, (_, c) => {
          if (r < map.height && c < map.width) {
            const cell = map.cells[r][c];
            return { ...cell, landmarkId: cell.landmarkId && keptIds.has(cell.landmarkId) ? cell.landmarkId : null };
          }
          return createEmptyCell();
        }),
      );

      // Resize terrain grid
      const terrainGrid = createTerrainGrid(newWidth, newHeight);
      if (map.terrainGrid) {
        for (let gy = 0; gy < minGH; gy++) {
          for (let gx = 0; gx < minGW; gx++) {
            terrainGrid[gy * newGW + gx] = map.terrainGrid[gy * oldGW + gx];
          }
        }
      }

      return { ...map, width: newWidth, height: newHeight, cells, terrainGrid, landmarks };
    });
  }

  setBackground(dataUrl: string | null) {
    this.updateMap(m => ({ ...m, background: dataUrl }));
  }

  setBackgroundTransform(transform: Partial<MapData['backgroundTransform']>) {
    this.updateMap(m => ({
      ...m,
      backgroundTransform: { ...m.backgroundTransform, ...transform },
    }));
  }

  setCellWater(row: number, col: number, value: boolean) {
    this._mutateCells(row, col, c => ({ ...c, water: value }));
  }

  /**
   * Paint or erase terrain using a circular brush.
   * @param worldX - x position in cell units (fractional, 0 = left edge of map)
   * @param worldY - y position in cell units (fractional)
   * @param brushRadiusCells - brush radius in cell units (e.g. 1.5 = 1.5 cells)
   * @param terrainType - 0-4 to paint, -1 to erase
   */
  setTerrainBrush(worldX: number, worldY: number, brushRadiusCells: number, terrainType: number) {
    const map = this.mapData();
    const scale = TERRAIN_SCALE;
    const gW = map.width * scale;
    const gH = map.height * scale;

    // Work in sub-cell space
    const cx = worldX * scale;
    const cy = worldY * scale;
    const r = brushRadiusCells * scale;
    const r2 = r * r;

    const base = map.terrainGrid ?? createTerrainGrid(map.width, map.height);
    const grid = [...base]; // shallow copy — values are numbers so this is safe

    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(gW - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(gH - 1, Math.ceil(cy + r));

    for (let sy = y0; sy <= y1; sy++) {
      for (let sx = x0; sx <= x1; sx++) {
        // Use the sub-cell center for circle test
        const dx = sx + 0.5 - cx;
        const dy = sy + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) {
          grid[sy * gW + sx] = terrainType;
        }
      }
    }

    this.mapData.update(m => ({ ...m, terrainGrid: grid }));
    this.markDirty();
  }

  setCellPath(row: number, col: number, value: boolean) {
    this._mutateCells(row, col, c => ({ ...c, path: value }));
  }

  private _mutateCells(row: number, col: number, fn: (c: MapCell) => MapCell) {
    const map = this.mapData();
    if (row < 0 || row >= map.height || col < 0 || col >= map.width) return;
    const cells = map.cells.map((r, ri) =>
      ri === row ? r.map((c, ci) => (ci === col ? fn(c) : c)) : r,
    );
    this.mapData.update(m => ({ ...m, cells }));
    this.markDirty();
  }

  // ─── Landmarks ────────────────────────────────────────────────────────────

  addLandmark(x: number, y: number, width: 1 | 2, height: 1 | 2, type: Landmark['type']): string {
    const id = generateId();
    const landmark: Landmark = {
      id, x, y, width, height, type,
      name: type.charAt(0).toUpperCase() + type.slice(1),
      description: '',
      pokemon: [],
    };

    this.updateMap(map => {
      // Mark cells as occupied
      const cells = map.cells.map((r, ri) =>
        r.map((c, ci) =>
          ri >= y && ri < y + height && ci >= x && ci < x + width
            ? { ...c, landmarkId: id }
            : c,
        ),
      );
      return { ...map, cells, landmarks: [...map.landmarks, landmark] };
    });
    return id;
  }

  removeLandmark(id: string) {
    this.updateMap(map => {
      const cells = map.cells.map(r =>
        r.map(c => (c.landmarkId === id ? { ...c, landmarkId: null } : c)),
      );
      return { ...map, cells, landmarks: map.landmarks.filter(l => l.id !== id) };
    });
  }

  updateLandmark(id: string, updates: Partial<Omit<Landmark, 'id' | 'x' | 'y' | 'width' | 'height'>>) {
    this.updateMap(map => ({
      ...map,
      landmarks: map.landmarks.map(l => (l.id === id ? { ...l, ...updates } : l)),
    }));
  }

  getLandmarkAt(row: number, col: number): Landmark | null {
    const map = this.mapData();
    const cell = map.cells[row]?.[col];
    if (!cell?.landmarkId) return null;
    return map.landmarks.find(l => l.id === cell.landmarkId) ?? null;
  }

  // ─── Pokedex ──────────────────────────────────────────────────────────────

  isInDex(pokemonId: string | number): boolean {
    return this.pokedex().some(e => e.pokemonId === pokemonId);
  }

  addDexEntry(pokemonId: string | number, isCustom = false, isRegional = false, baseFormId: string | number | null = null, types?: string[]) {
    if (this.isInDex(pokemonId)) return;
    this.pokedex.update(dex => {
      const maxNum = dex.length > 0 ? Math.max(...dex.map(e => e.dexNumber)) : 0;
      return [
        ...dex,
        { dexNumber: maxNum + 1, pokemonId, isCustom, isRegional, baseFormId, types },
      ];
    });
    this.markDirty();
  }

  removeDexEntry(pokemonId: string | number) {
    this.pokedex.update(dex => {
      const filtered = dex.filter(e => e.pokemonId !== pokemonId);
      return filtered.map((e, i) => ({ ...e, dexNumber: i + 1 }));
    });
    this.markDirty();
  }

  reorderDex(previousIndex: number, currentIndex: number) {
    this.pokedex.update(dex => {
      const arr = [...dex];
      const [item] = arr.splice(previousIndex, 1);
      arr.splice(currentIndex, 0, item);
      return arr.map((e, i) => ({ ...e, dexNumber: i + 1 }));
    });
    this.markDirty();
  }

  updateDexEntryTypes(pokemonId: string | number, types: string[]) {
    this.pokedex.update(dex =>
      dex.map(e => (e.pokemonId === pokemonId ? { ...e, types } : e)),
    );
  }

  // ─── Custom Pokemon ───────────────────────────────────────────────────────

  addCustomPokemon(p: CustomPokemon) {
    this.customPokemon.update(list => [...list, p]);
    this.markDirty();
  }

  updateCustomPokemon(id: string, updates: Partial<CustomPokemon>) {
    this.customPokemon.update(list =>
      list.map(p => (p.id === id ? { ...p, ...updates } : p)),
    );
    this.markDirty();
  }

  removeCustomPokemon(id: string) {
    this.customPokemon.update(list => list.filter(p => p.id !== id));
    this.markDirty();
  }

  addCustomMove(move: CustomMove) {
    this.customMoves.update(list => [...list, move]);
    this.markDirty();
  }

  removeCustomMove(id: string) {
    this.customMoves.update(list => list.filter(m => m.id !== id));
    this.markDirty();
  }

  addCustomAbility(ability: CustomAbility) {
    this.customAbilities.update(list => [...list, ability]);
    this.markDirty();
  }

  removeCustomAbility(id: string) {
    this.customAbilities.update(list => list.filter(a => a.id !== id));
    this.markDirty();
  }
}
