export interface PokemonListItem {
  id: number;
  name: string;
  displayName: string;
  spriteUrl: string;
}

export interface PokedexEntry {
  dexNumber: number;
  pokemonId: string | number; // number for PokeAPI canon, "custom-..." for custom
  isCustom: boolean;
  isRegional: boolean;
  baseFormId: string | number | null;
  types?: string[]; // cached types
}

export interface StatBlock {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

export interface CustomMove {
  id: string;
  name: string;
  type: string;
  category: 'physical' | 'special' | 'status';
  power: number | null;
  accuracy: number | null;
  pp: number;
  description: string;
}

export interface CustomAbility {
  id: string;
  name: string;
  description: string;
}

export interface CustomPokemon {
  id: string; // "custom-<uuid>"
  name: string;
  description: string; // Pokédex flavor text
  types: [string, string | null];
  height: number; // meters
  weight: number; // kg
  stats: StatBlock;
  moves: string[]; // move ids (custom-... or canonical move names)
  abilities: string[]; // ability ids
  spriteDataUrl: string | null;
  isRegionalForm: boolean;
  baseFormId: string | number | null; // PokeAPI id or custom id
}

export interface RegionData {
  version: number;
  name: string;
  mapData: import('./map.model').MapData;
  pokedex: PokedexEntry[];
  customPokemon: CustomPokemon[];
  customMoves: CustomMove[];
  customAbilities: CustomAbility[];
}

export const POKEMON_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

export const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
};

const REGIONAL_TAGS: Record<string, string> = {
  alola: 'Alola', alolan: 'Alola',
  galar: 'Galar', galarian: 'Galar',
  hisui: 'Hisui', hisuian: 'Hisui',
  paldea: 'Paldea', paldean: 'Paldea',
};

export function formatPokemonName(name: string): string {
  const parts = name.split('-');
  const last = parts[parts.length - 1].toLowerCase();
  if (parts.length >= 2 && REGIONAL_TAGS[last]) {
    const base = parts.slice(0, -1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${base} (${REGIONAL_TAGS[last]})`;
  }
  return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function generateId(): string {
  return 'custom-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
