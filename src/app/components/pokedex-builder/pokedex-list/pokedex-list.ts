import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { RegionStateService } from '../../../services/region-state.service';
import { PokemonDataService } from '../../../services/pokemon-data.service';
import { ModalComponent } from '../../shared/modal/modal';
import { PokemonSelectorComponent } from '../../shared/pokemon-selector/pokemon-selector';
import { TYPE_COLORS } from '../../../models/pokemon.model';

@Component({
  selector: 'app-pokedex-list',
  standalone: true,
  imports: [CommonModule, DragDropModule, ModalComponent, PokemonSelectorComponent],
  templateUrl: './pokedex-list.html',
  styleUrl: './pokedex-list.css',
})
export class PokedexListComponent {
  state = inject(RegionStateService);
  pokeData = inject(PokemonDataService);

  showAddModal = signal(false);
  typeColors = TYPE_COLORS;

  pokedex = computed(() => this.state.pokedex());
  pokedexIds = computed(() => this.state.pokedex().map(e => e.pokemonId));

  onDrop(event: CdkDragDrop<any[]>) {
    if (event.previousIndex === event.currentIndex) return;
    this.state.reorderDex(event.previousIndex, event.currentIndex);
  }

  onAddSelection(ids: (string | number)[]) {
    for (const id of ids) {
      if (!this.state.isInDex(id)) {
        const isCustom = typeof id === 'string' && id.startsWith('custom-');
        this.state.addDexEntry(id, isCustom, false, null);
        if (!isCustom) {
          // Fetch types in background
          this.pokeData.fetchTypes(id as number).then(types => {
            this.state.updateDexEntryTypes(id, types);
          });
        }
      }
    }
  }

  remove(pokemonId: string | number) {
    this.state.removeDexEntry(pokemonId);
  }

  getSpriteUrl(id: string | number): string {
    if (typeof id === 'number') return this.pokeData.getSpriteUrl(id);
    const numId = parseInt(String(id));
    if (!isNaN(numId)) return this.pokeData.getSpriteUrl(numId);
    const cp = this.state.customPokemon().find(p => p.id === id);
    return cp?.spriteDataUrl ?? '';
  }

  getDisplayName(id: string | number): string {
    if (typeof id === 'number') return this.pokeData.getDisplayName(id);
    const numId = parseInt(String(id));
    if (!isNaN(numId)) return this.pokeData.getDisplayName(numId);
    const cp = this.state.customPokemon().find(p => p.id === String(id));
    return cp?.name ?? String(id);
  }

  getTypes(pokemonId: string | number): string[] {
    // Check dex entry first
    const entry = this.state.pokedex().find(e => e.pokemonId === pokemonId);
    if (entry?.types) return entry.types;

    // Check custom pokemon
    if (typeof pokemonId === 'string' && pokemonId.startsWith('custom-')) {
      const cp = this.state.customPokemon().find(p => p.id === pokemonId);
      if (cp) return cp.types.filter(Boolean) as string[];
    }

    // Check PokeAPI types cache
    const numId = typeof pokemonId === 'number' ? pokemonId : parseInt(String(pokemonId));
    return this.pokeData.typesCache()[numId] ?? [];
  }

  typeColor(t: string): string {
    return this.typeColors[t] ?? '#888';
  }

  imgError(e: Event) {
    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23333"/><text x="50%" y="55%" text-anchor="middle" fill="%23666" font-size="18">?</text></svg>';
  }
}
