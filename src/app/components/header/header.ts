import { Component, Input, Output, EventEmitter, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegionStateService } from '../../services/region-state.service';
import { SerializationService } from '../../services/serialization.service';
import { PokemonDataService } from '../../services/pokemon-data.service';

export type AppMode = 'map' | 'dex';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent {
  @Input() mode: AppMode = 'map';
  @Output() modeChange = new EventEmitter<AppMode>();
  @Output() newRegion = new EventEmitter<void>();
  @Output() canvasExportRequest = new EventEmitter<void>();

  state = inject(RegionStateService);
  serial = inject(SerializationService);
  pokeData = inject(PokemonDataService);
  private el = inject(ElementRef);

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target)) {
      this.exportMenuOpen.set(false);
    }
  }

  exportMenuOpen = signal(false);
  editingName = signal(false);
  nameInput = signal('');

  get regionName() { return this.state.regionName(); }

  startEditName() {
    this.nameInput.set(this.state.regionName());
    this.editingName.set(true);
  }

  saveNameEdit() {
    const n = this.nameInput().trim();
    if (n) this.state.setRegionName(n);
    this.editingName.set(false);
  }

  saveFile() {
    this.serial.saveToFile();
    this.exportMenuOpen.set(false);
  }

  async loadFile() {
    await this.serial.loadFromFile();
    this.exportMenuOpen.set(false);
  }

  exportMap() {
    this.canvasExportRequest.emit();
    this.exportMenuOpen.set(false);
  }

  exportDex() {
    const names = new Map<string | number, string>();
    for (const p of this.pokeData.pokemonList()) {
      names.set(p.id, p.displayName);
    }
    for (const cp of this.state.customPokemon()) {
      names.set(cp.id, cp.name);
    }
    this.serial.exportDexText(names);
    this.exportMenuOpen.set(false);
  }

  copyShareUrl() {
    const url = this.serial.getShareUrl();
    navigator.clipboard.writeText(url).then(() => alert('Share URL copied to clipboard!'));
    this.exportMenuOpen.set(false);
  }

  toggleExportMenu() { this.exportMenuOpen.update(v => !v); }

  closeExportMenu() { this.exportMenuOpen.set(false); }
}
