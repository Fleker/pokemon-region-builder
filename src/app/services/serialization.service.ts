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
    const pokedex = this.state.pokedex();
    const customPokemon = this.state.customPokemon();
    const regionName = this.state.regionName();

    const canonEntries = pokedex.filter(e => !e.isCustom);
    const customEntries = pokedex.filter(e => e.isCustom);

    const lines: string[] = [
      `${regionName} Regional Pokédex`,
      '='.repeat(40),
      '',
      '── Canonical Pokémon ──',
    ];

    for (const entry of canonEntries) {
      const name = pokemonNames.get(entry.pokemonId) ?? `#${entry.pokemonId}`;
      const regional = entry.isRegional ? ' [Regional Form]' : '';
      lines.push(`#${String(entry.dexNumber).padStart(3, '0')}  ${name}${regional}`);
    }

    if (customEntries.length > 0) {
      lines.push('', '── New / Custom Pokémon ──');
      for (const entry of customEntries) {
        const cp = customPokemon.find(p => p.id === entry.pokemonId);
        const name = cp ? cp.name : String(entry.pokemonId);
        const regional = entry.isRegional ? ' [Regional Form]' : '';
        lines.push(`#${String(entry.dexNumber).padStart(3, '0')}  ${name}${regional}  (Fan-made)`);
      }
    }

    const text = lines.join('\n');
    this.downloadText(text, `${this.sanitizeName(regionName)}-pokedex.txt`, 'text/plain');
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
