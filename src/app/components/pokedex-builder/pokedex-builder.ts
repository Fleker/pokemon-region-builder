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
    return this.customPokemon().filter(p => p.moves.includes(moveId));
  }

  pokemonWithAbility(abilityId: string): CustomPokemon[] {
    return this.customPokemon().filter(p => p.abilities.includes(abilityId));
  }
}
