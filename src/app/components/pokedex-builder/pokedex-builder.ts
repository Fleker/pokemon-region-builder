import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokedexListComponent } from './pokedex-list/pokedex-list';
import { PokemonEditorComponent } from './pokemon-editor/pokemon-editor';
import { BalanceCheckComponent } from './balance-check/balance-check';

@Component({
  selector: 'app-pokedex-builder',
  standalone: true,
  imports: [CommonModule, PokedexListComponent, PokemonEditorComponent, BalanceCheckComponent],
  templateUrl: './pokedex-builder.html',
  styleUrl: './pokedex-builder.css',
})
export class PokedexBuilderComponent {}
