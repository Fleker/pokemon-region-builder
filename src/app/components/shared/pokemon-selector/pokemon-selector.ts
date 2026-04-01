import {
  Component, Input, Output, EventEmitter, OnInit, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokemonDataService } from '../../../services/pokemon-data.service';
import { RegionStateService } from '../../../services/region-state.service';
import { PokemonListItem, CustomPokemon, POKEMON_TYPES, TYPE_COLORS } from '../../../models/pokemon.model';

const PAGE_SIZE = 48;

@Component({
  selector: 'app-pokemon-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pokemon-selector.html',
  styleUrl: './pokemon-selector.css',
})
export class PokemonSelectorComponent implements OnInit {
  /** Current selected IDs (can be number for canon or "custom-..." for custom) */
  @Input() selectedIds: (string | number)[] = [];
  /** If true, acts as a multi-select toggle; false = single-select emit */
  @Input() multiSelect = true;
  @Output() selectionChange = new EventEmitter<(string | number)[]>();

  private pokeData = inject(PokemonDataService);
  private state = inject(RegionStateService);

  readonly types = POKEMON_TYPES;
  readonly typeColors = TYPE_COLORS;

  searchQuery = signal('');
  typeFilter = signal<string | null>(null);
  page = signal(0);

  loading = this.pokeData.loading;
  error = this.pokeData.error;

  allItems = computed<(PokemonListItem & { isCustom?: boolean })[]>(() => {
    const rawCanon = this.pokeData.pokemonList();
    const REGIONAL_SFXS = ['-alola', '-galar', '-hisui', '-paldea'];

    // Separate standard (id ≤ 1010) from regional forms
    const standard: PokemonListItem[] = [];
    const regional: PokemonListItem[] = [];
    for (const p of rawCanon) {
      REGIONAL_SFXS.some(s => p.name.endsWith(s)) ? regional.push(p) : standard.push(p);
    }

    // Build name→index map so we can insert each regional form after its base
    const nameToIdx = new Map(standard.map((p, i) => [p.name, i]));
    const insertAfter = new Map<number, PokemonListItem[]>();
    const orphans: PokemonListItem[] = [];

    for (const r of regional) {
      let placed = false;
      for (const sfx of REGIONAL_SFXS) {
        if (r.name.endsWith(sfx)) {
          const idx = nameToIdx.get(r.name.slice(0, -sfx.length));
          if (idx !== undefined) {
            const arr = insertAfter.get(idx) ?? [];
            arr.push(r);
            insertAfter.set(idx, arr);
            placed = true;
            break;
          }
        }
      }
      if (!placed) orphans.push(r);
    }

    // Rebuild list with regional forms inserted right after their base
    const sorted: (PokemonListItem & { isCustom?: boolean })[] = [];
    for (let i = 0; i < standard.length; i++) {
      sorted.push(standard[i]);
      const extra = insertAfter.get(i);
      if (extra) sorted.push(...extra);
    }
    sorted.push(...orphans);

    const custom: (PokemonListItem & { isCustom?: boolean })[] = this.state.customPokemon().map(cp => ({
      id: cp.id as any,
      name: cp.id,
      displayName: cp.name + ' ★',
      spriteUrl: cp.spriteDataUrl ?? '',
      types: cp.types.filter(Boolean) as string[],
      isCustom: true,
    }));

    return [...sorted, ...custom];
  });

  loadingTypeFilter = computed(() => {
    const type = this.typeFilter();
    return !!type && !this.pokeData.typeIndex()[type];
  });

  filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const type = this.typeFilter();
    const typeIdx = this.pokeData.typeIndex();
    return this.allItems().filter(p => {
      const matchesName = !q || p.displayName.toLowerCase().includes(q) || String(p.id).includes(q);
      if (!type) return matchesName;
      // Custom Pokemon have types directly on the item
      if (p.isCustom) {
        return matchesName && ((p as any).types ?? []).includes(type);
      }
      const typeSet = typeIdx[type];
      if (!typeSet) return false; // still loading
      return matchesName && typeSet.has(p.id as number);
    });
  });

  pageItems = computed(() => {
    const start = this.page() * PAGE_SIZE;
    return this.filteredItems().slice(start, start + PAGE_SIZE);
  });

  totalPages = computed(() => Math.ceil(this.filteredItems().length / PAGE_SIZE));

  ngOnInit() { /* list loaded by service constructor */ }

  isSelected(id: string | number): boolean {
    return this.selectedIds.includes(id);
  }

  toggle(id: string | number) {
    let next: (string | number)[];
    if (this.multiSelect) {
      next = this.isSelected(id)
        ? this.selectedIds.filter(x => x !== id)
        : [...this.selectedIds, id];
    } else {
      next = [id];
    }
    this.selectionChange.emit(next);
  }

  onSearch(q: string) {
    this.searchQuery.set(q);
    this.page.set(0);
  }

  setType(type: string | null) {
    this.typeFilter.set(type);
    this.page.set(0);
    if (type) this.pokeData.fetchTypeIndex(type);
  }

  prevPage() { this.page.update(p => Math.max(0, p - 1)); }
  nextPage() { this.page.update(p => Math.min(this.totalPages() - 1, p + 1)); }

  typeColor(type: string): string {
    return this.typeColors[type] ?? '#888';
  }

  imgError(e: Event) {
    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23333"/><text x="50%" y="55%" text-anchor="middle" fill="%23666" font-size="18">?</text></svg>';
  }
}
