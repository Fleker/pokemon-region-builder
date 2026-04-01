import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegionStateService } from '../../../services/region-state.service';
import { PokemonDataService } from '../../../services/pokemon-data.service';
import { POKEMON_TYPES, TYPE_COLORS } from '../../../models/pokemon.model';

interface TypeCount { type: string; count: number; percent: number; color: string; warning: boolean; }
interface CoverageIssue { message: string; severity: 'error' | 'warning'; }

@Component({
  selector: 'app-balance-check',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './balance-check.html',
  styleUrl: './balance-check.css',
})
export class BalanceCheckComponent {
  state = inject(RegionStateService);
  pokeData = inject(PokemonDataService);

  expanded = signal(false);

  typeCounts = computed<TypeCount[]>(() => {
    const dex = this.state.pokedex();
    const customPkmn = this.state.customPokemon();
    const typesCache = this.pokeData.typesCache();
    const total = dex.length;
    if (total === 0) return [];

    const counts: Record<string, number> = {};
    for (const type of POKEMON_TYPES) counts[type] = 0;

    for (const entry of dex) {
      let types: string[] = [];

      if (entry.isCustom) {
        const cp = customPkmn.find(p => p.id === entry.pokemonId);
        if (cp) types = cp.types.filter(Boolean) as string[];
      } else if (entry.types) {
        types = entry.types;
      } else {
        const numId = typeof entry.pokemonId === 'number'
          ? entry.pokemonId
          : parseInt(String(entry.pokemonId));
        types = typesCache[numId] ?? [];
      }

      for (const t of types) {
        if (t in counts) counts[t]++;
      }
    }

    return POKEMON_TYPES.map(type => {
      const count = counts[type];
      const percent = total > 0 ? (count / total) * 100 : 0;
      return {
        type,
        count,
        percent,
        color: TYPE_COLORS[type] ?? '#888',
        warning: count === 0 || percent > 35,
      };
    }).sort((a, b) => b.count - a.count);
  });

  coverageIssues = computed<CoverageIssue[]>(() => {
    const issues: CoverageIssue[] = [];
    const dex = this.state.pokedex();
    const map = this.state.mapData();

    // Collect all pokemon IDs from landmark assignments
    const landmarkPokemon = new Set<string>();
    for (const lm of map.landmarks) {
      for (const id of lm.pokemon) landmarkPokemon.add(id);
    }

    // All dex IDs as strings
    const dexIds = new Set(dex.map(e => String(e.pokemonId)));

    // Check 1: Landmark pokemon not in dex
    for (const id of landmarkPokemon) {
      if (!dexIds.has(id)) {
        const name = this.getDisplayName(id);
        issues.push({ message: `${name} appears on the map but is not in the Pokédex`, severity: 'error' });
      }
    }

    // Check 2: Dex pokemon not on any landmark
    for (const entry of dex) {
      const id = String(entry.pokemonId);
      if (!landmarkPokemon.has(id)) {
        const name = this.getDisplayName(entry.pokemonId);
        issues.push({ message: `${name} is in the Pokédex but doesn't appear at any landmark`, severity: 'warning' });
      }
    }

    // Check 3: Type balance warnings
    const counts = this.typeCounts();
    const zeroTypes = counts.filter(t => t.count === 0);
    if (zeroTypes.length > 0) {
      issues.push({
        message: `Missing types: ${zeroTypes.map(t => t.type).join(', ')}`,
        severity: 'warning',
      });
    }

    return issues;
  });

  errorCount = computed(() => this.coverageIssues().filter(i => i.severity === 'error').length);
  warningCount = computed(() => this.coverageIssues().filter(i => i.severity === 'warning').length);

  private getDisplayName(id: string | number): string {
    const strId = String(id);
    if (strId.startsWith('custom-')) {
      const cp = this.state.customPokemon().find(p => p.id === strId);
      return cp?.name ?? strId;
    }
    const numId = parseInt(strId);
    if (!isNaN(numId)) return this.pokeData.getDisplayName(numId);
    return strId;
  }
}
