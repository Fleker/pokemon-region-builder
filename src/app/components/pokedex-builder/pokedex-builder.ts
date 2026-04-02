import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokedexListComponent } from './pokedex-list/pokedex-list';
import { PokemonEditorComponent } from './pokemon-editor/pokemon-editor';
import { BalanceCheckComponent } from './balance-check/balance-check';
import { RegionStateService } from '../../services/region-state.service';
import { CustomPokemon } from '../../models/pokemon.model';

@Component({
  selector: 'app-pokedex-builder',
  standalone: true,
  imports: [CommonModule, PokedexListComponent, PokemonEditorComponent, BalanceCheckComponent],
  templateUrl: './pokedex-builder.html',
  styleUrl: './pokedex-builder.css',
})
export class PokedexBuilderComponent {
  private state = inject(RegionStateService);

  customMoves     = computed(() => this.state.customMoves());
  customAbilities = computed(() => this.state.customAbilities());
  customPokemon   = computed(() => this.state.customPokemon());

  pokemonWithMove(moveId: string): CustomPokemon[] {
    const name = this.customMoves().find(m => m.id === moveId)?.name ?? '';
    return this.customPokemon().filter(p =>
      p.moves.some(m => m === moveId || (name && m.toLowerCase() === name.toLowerCase()))
    );
  }

  pokemonWithAbility(abilityId: string): CustomPokemon[] {
    const name = this.customAbilities().find(a => a.id === abilityId)?.name ?? '';
    return this.customPokemon().filter(p =>
      p.abilities.some(a => a === abilityId || (name && a.toLowerCase() === name.toLowerCase()))
    );
  }

  removeMove(id: string)    { this.state.removeCustomMove(id); }
  removeAbility(id: string) { this.state.removeCustomAbility(id); }
}
