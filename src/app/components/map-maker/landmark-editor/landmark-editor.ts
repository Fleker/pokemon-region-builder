import { Component, Input, Output, EventEmitter, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegionStateService } from '../../../services/region-state.service';
import { PokemonDataService } from '../../../services/pokemon-data.service';
import { ModalComponent } from '../../shared/modal/modal';
import { PokemonSelectorComponent } from '../../shared/pokemon-selector/pokemon-selector';
import { Landmark } from '../../../models/map.model';
import { TYPE_COLORS } from '../../../models/pokemon.model';

@Component({
  selector: 'app-landmark-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, PokemonSelectorComponent],
  templateUrl: './landmark-editor.html',
  styleUrl: './landmark-editor.css',
})
export class LandmarkEditorComponent {
  @Input() landmarkId: string | null = null;
  @Output() closed = new EventEmitter<void>();

  state = inject(RegionStateService);
  pokeData = inject(PokemonDataService);

  showPokemonSelector = signal(false);
  typeColors = TYPE_COLORS;

  get landmark(): Landmark | null {
    if (!this.landmarkId) return null;
    return this.state.mapData().landmarks.find(l => l.id === this.landmarkId) ?? null;
  }

  get pokemon(): string[] {
    return this.landmark?.pokemon ?? [];
  }

  updateName(name: string) {
    if (this.landmarkId) this.state.updateLandmark(this.landmarkId, { name });
  }

  updateDescription(desc: string) {
    if (this.landmarkId) this.state.updateLandmark(this.landmarkId, { description: desc });
  }

  onPokemonSelectionChange(ids: (string | number)[]) {
    if (this.landmarkId) {
      this.state.updateLandmark(this.landmarkId, { pokemon: ids.map(String) });
    }
  }

  removePokemon(id: string) {
    if (!this.landmarkId) return;
    const newList = this.pokemon.filter(p => p !== id);
    this.state.updateLandmark(this.landmarkId, { pokemon: newList });
  }

  deleteLandmark() {
    if (this.landmarkId) this.state.removeLandmark(this.landmarkId);
    this.closed.emit();
  }

  getSpriteUrl(id: string): string {
    const numId = parseInt(id);
    if (!isNaN(numId)) return this.pokeData.getSpriteUrl(numId);
    const cp = this.state.customPokemon().find(p => p.id === id);
    return cp?.spriteDataUrl ?? '';
  }

  getDisplayName(id: string): string {
    const numId = parseInt(id);
    if (!isNaN(numId)) return this.pokeData.getDisplayName(numId);
    const cp = this.state.customPokemon().find(p => p.id === id);
    return cp?.name ?? id;
  }

  imgError(e: Event) {
    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23333"/><text x="50%" y="55%" text-anchor="middle" fill="%23666" font-size="18">?</text></svg>';
  }
}
