import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PokemonListItem, formatPokemonName } from '../models/pokemon.model';

const LIST_CACHE_KEY = 'pkmn-regions-list-v4';
const TYPES_CACHE_KEY = 'pkmn-regions-types-v2';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable({ providedIn: 'root' })
export class PokemonDataService {
  private http = inject(HttpClient);

  pokemonList = signal<PokemonListItem[]>([]);
  typesCache = signal<Record<number, string[]>>({});
  /** Maps type name → Set of Pokemon IDs with that type (fetched lazily per type). */
  typeIndex = signal<Record<string, Set<number>>>({});
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    this.loadList();
    this.loadTypesFromStorage();
  }

  private loadList() {
    const raw = localStorage.getItem(LIST_CACHE_KEY);
    if (raw) {
      try {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) {
          this.pokemonList.set(data);
          return;
        }
      } catch { /* stale/corrupt, re-fetch */ }
    }
    this.fetchList();
  }

  private fetchList() {
    this.loading.set(true);
    this.http.get<any>('https://pokeapi.co/api/v2/pokemon?limit=2000').subscribe({
      next: (res) => {
        const REGIONAL_SUFFIXES = ['-alola', '-galar', '-hisui', '-paldea'];
        const data: PokemonListItem[] = [];

        for (const p of res.results as { name: string; url: string }[]) {
          // Extract numeric ID from URL like ".../pokemon/10070/"
          const urlId = parseInt(p.url.replace(/\/$/, '').split('/').pop() ?? '0');
          const isStandard = urlId >= 1 && urlId <= 1025;
          const isRegional = REGIONAL_SUFFIXES.some(sfx => p.name.endsWith(sfx));

          if (!isStandard && !isRegional) continue;

          data.push({
            id: urlId,
            name: p.name,
            displayName: formatPokemonName(p.name),
            spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${urlId}.png`,
          });
        }

        this.pokemonList.set(data);
        localStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load Pokémon list. Check your connection.');
        this.loading.set(false);
      },
    });
  }

  private loadTypesFromStorage() {
    const raw = localStorage.getItem(TYPES_CACHE_KEY);
    if (raw) {
      try {
        this.typesCache.set(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }

  fetchTypeIndex(typeName: string): void {
    if (this.typeIndex()[typeName]) return; // already cached
    this.http.get<any>(`https://pokeapi.co/api/v2/type/${typeName}`).subscribe({
      next: (data) => {
        const ids = new Set<number>(
          (data.pokemon as { pokemon: { url: string } }[])
            .map(entry => {
              const m = entry.pokemon.url.replace(/\/$/, '').match(/(\d+)$/);
              return m ? parseInt(m[1]) : null;
            })
            .filter((id): id is number => id !== null),
        );
        this.typeIndex.update(idx => ({ ...idx, [typeName]: ids }));
      },
      error: () => {
        // Cache empty set so we don't retry
        this.typeIndex.update(idx => ({ ...idx, [typeName]: new Set<number>() }));
      },
    });
  }

  async fetchTypes(id: number): Promise<string[]> {
    const cache = this.typesCache();
    if (cache[id]) return cache[id];

    return new Promise((resolve) => {
      this.http.get<any>(`https://pokeapi.co/api/v2/pokemon/${id}`).subscribe({
        next: (data) => {
          const types: string[] = data.types.map((t: any) => t.type.name as string);
          this.updateTypesCache(id, types);
          resolve(types);
        },
        error: () => resolve([]),
      });
    });
  }

  private updateTypesCache(id: number, types: string[]) {
    const newCache = { ...this.typesCache(), [id]: types };
    this.typesCache.set(newCache);
    localStorage.setItem(TYPES_CACHE_KEY, JSON.stringify(newCache));
  }

  getSpriteUrl(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  }

  getById(id: number): PokemonListItem | undefined {
    return this.pokemonList().find(p => p.id === id);
  }

  getDisplayName(id: number | string): string {
    if (typeof id === 'string') return id; // custom
    const p = this.getById(id);
    return p ? p.displayName : `#${id}`;
  }

  search(query: string, typeFilter: string | null): PokemonListItem[] {
    const list = this.pokemonList();
    const q = query.toLowerCase().trim();
    const cache = this.typesCache();

    return list.filter(p => {
      const matchesName = !q || p.displayName.toLowerCase().includes(q) || p.name.includes(q);
      const matchesType = !typeFilter || (cache[p.id] || []).includes(typeFilter);
      return matchesName && matchesType;
    });
  }
}
