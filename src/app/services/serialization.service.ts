import { Injectable, inject } from '@angular/core';
import { RegionStateService } from './region-state.service';
import { RegionData, PokedexEntry } from '../models/pokemon.model';

@Injectable({ providedIn: 'root' })
export class SerializationService {
  private state = inject(RegionStateService);

  // ─── File save / load ──────────────────────────────────────────────────────

  saveToFile() {
    const data = this.state.getRegionData();
    const json = JSON.stringify(data, null, 2);
    this.downloadText(json, `${this.sanitizeName(data.name)}.pkregion`, 'application/json');
    this.state.hasUnsavedChanges.set(false);
  }

  async loadFromFile(): Promise<void> {
    const file = await this.pickFile('.pkregion,application/json');
    if (!file) return;
    const text = await file.text();
    try {
      const data: RegionData = JSON.parse(text);
      if (data.version !== 1) throw new Error('Unknown file version');
      this.state.loadRegion(data);
    } catch (e) {
      alert('Failed to load file: ' + (e as Error).message);
    }
  }

  // ─── URL sharing (base64) ─────────────────────────────────────────────────

  getShareUrl(): string {
    const data = this.state.getRegionData();
    const json = JSON.stringify(data);
    const b64 = btoa(encodeURIComponent(json));
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    url.searchParams.set('data', b64);
    return url.toString();
  }

  loadFromUrl(): RegionData | null {
    const params = new URLSearchParams(window.location.search);
    const b64 = params.get('data');
    if (!b64) return null;
    try {
      const json = decodeURIComponent(atob(b64));
      return JSON.parse(json) as RegionData;
    } catch {
      return null;
    }
  }

  // ─── Map PNG export ───────────────────────────────────────────────────────

  exportMapPng(canvas: HTMLCanvasElement) {
    const dataUrl = canvas.toDataURL('image/png');
    const name = this.sanitizeName(this.state.regionName()) + '-map.png';
    this.downloadDataUrl(dataUrl, name);
  }

  // ─── Dex text export ──────────────────────────────────────────────────────

  exportDexText(pokemonNames: Map<string | number, string>) {
    const pokedex   = this.state.pokedex();
    const customs   = this.state.customPokemon();
    const moves     = this.state.customMoves();
    const abilities = this.state.customAbilities();
    const regionName = this.state.regionName();

    const moveMap     = new Map(moves.map(m => [m.id, m]));
    const abilityMap  = new Map(abilities.map(a => [a.id, a]));
    const customPkMap = new Map(customs.map(p => [p.id, p]));

    const div  = '═'.repeat(44);
    const div2 = '─'.repeat(44);

    // ── Part 1: unified dex list ──────────────────────────────────────────
    const lines: string[] = [
      `${regionName} Regional Pokédex`,
      div,
      '',
    ];

    for (const entry of pokedex) {
      const num = `#${String(entry.dexNumber).padStart(3, '0')}`;
      const regional = entry.isRegional ? ' [Regional Form]' : '';
      if (entry.isCustom) {
        const cp = customPkMap.get(entry.pokemonId as string);
        const name = cp ? cp.name : String(entry.pokemonId);
        lines.push(`${num}  ${name} ★${regional}`);
      } else {
        const name = pokemonNames.get(entry.pokemonId) ?? `#${entry.pokemonId}`;
        lines.push(`${num}  ${name}${regional}`);
      }
    }

    // ── Part 2: fan-made Pokémon detail sheets ────────────────────────────
    const customEntries = pokedex.filter(e => e.isCustom);
    if (customEntries.length > 0) {
      lines.push('', '', div, 'Fan-made Pokémon Details', div, '');

      for (const entry of customEntries) {
        const cp = customPkMap.get(entry.pokemonId as string);
        if (!cp) continue;

        const num    = `#${String(entry.dexNumber).padStart(3, '0')}`;
        const types  = [cp.types[0], cp.types[1]].filter(Boolean).join(' / ');
        const bst    = cp.stats.hp + cp.stats.attack + cp.stats.defense
                     + cp.stats.spAttack + cp.stats.spDefense + cp.stats.speed;
        const regional = entry.isRegional ? ' [Regional Form]' : '';

        lines.push(`${num}  ${cp.name} ★${regional}`);
        lines.push(div2);
        lines.push(`  Type:    ${types}`);
        if (entry.isRegional && cp.baseFormId) {
          const baseName = pokemonNames.get(cp.baseFormId) ?? String(cp.baseFormId);
          lines.push(`  Base:    ${baseName}`);
        }
        lines.push(`  Height:  ${cp.height.toFixed(1)}m    Weight:  ${cp.weight.toFixed(1)}kg`);
        lines.push(
          `  HP:  ${String(cp.stats.hp).padEnd(4)} ` +
          `Atk: ${String(cp.stats.attack).padEnd(4)} ` +
          `Def: ${String(cp.stats.defense).padEnd(4)} ` +
          `SpA: ${String(cp.stats.spAttack).padEnd(4)} ` +
          `SpD: ${String(cp.stats.spDefense).padEnd(4)} ` +
          `Spe: ${String(cp.stats.speed).padEnd(4)} ` +
          `(BST ${bst})`,
        );

        // Abilities
        if (cp.abilities.length > 0) {
          lines.push('');
          lines.push('  Abilities');
          for (const aId of cp.abilities) {
            const custom = abilityMap.get(aId);
            if (custom) {
              lines.push(`    · ${custom.name}  ‹fan-made›`);
              if (custom.description) lines.push(`        ${custom.description}`);
            } else {
              lines.push(`    · ${aId}`);
            }
          }
        }

        // Moves
        if (cp.moves.length > 0) {
          lines.push('');
          lines.push('  Moves');
          for (const mId of cp.moves) {
            const custom = moveMap.get(mId);
            if (custom) {
              const pwr = custom.power   != null ? `Pwr ${custom.power}` : '—';
              const acc = custom.accuracy != null ? `Acc ${custom.accuracy}%` : '—';
              lines.push(`    · ${custom.name}  ‹fan-made›`);
              lines.push(`        ${custom.type} | ${custom.category} | ${pwr} | ${acc} | ${custom.pp} PP`);
              if (custom.description) lines.push(`        ${custom.description}`);
            } else {
              lines.push(`    · ${mId}`);
            }
          }
        }

        lines.push('');
      }
    }

    // ── Part 3: all custom moves catalogue ───────────────────────────────
    if (moves.length > 0) {
      lines.push(div, 'Custom Moves', div, '');
      for (const m of moves) {
        const pwr = m.power    != null ? `Pwr ${m.power}` : '—';
        const acc = m.accuracy != null ? `Acc ${m.accuracy}%` : '—';
        lines.push(`${m.name}`);
        lines.push(`  ${m.type} | ${m.category} | ${pwr} | ${acc} | ${m.pp} PP`);
        if (m.description) lines.push(`  ${m.description}`);
        lines.push('');
      }
    }

    // ── Part 4: all custom abilities catalogue ────────────────────────────
    if (abilities.length > 0) {
      lines.push(div, 'Custom Abilities', div, '');
      for (const a of abilities) {
        lines.push(`${a.name}`);
        if (a.description) lines.push(`  ${a.description}`);
        lines.push('');
      }
    }

    this.downloadText(
      lines.join('\n'),
      `${this.sanitizeName(regionName)}-pokedex.txt`,
      'text/plain',
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private sanitizeName(name: string): string {
    return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() || 'region';
  }

  private downloadText(text: string, filename: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    this.triggerDownload(url, filename);
    URL.revokeObjectURL(url);
  }

  private downloadDataUrl(dataUrl: string, filename: string) {
    this.triggerDownload(dataUrl, filename);
  }

  private triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  private pickFile(accept: string): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.oncancel = () => resolve(null);
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }
}
