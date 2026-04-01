import { Component, signal, ViewChild, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent, AppMode } from './components/header/header';
import { MapMakerComponent } from './components/map-maker/map-maker';
import { PokedexBuilderComponent } from './components/pokedex-builder/pokedex-builder';
import { ModalComponent } from './components/shared/modal/modal';
import { RegionStateService } from './services/region-state.service';
import { SerializationService } from './services/serialization.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    MapMakerComponent,
    PokedexBuilderComponent,
    ModalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  @ViewChild(MapMakerComponent) mapMaker?: MapMakerComponent;

  mode = signal<AppMode>('map');
  showNewRegionDialog = signal(false);

  // New region form
  newName = signal('My Region');
  newWidth = signal(80);
  newHeight = signal(60);
  newStyle = signal<'rs' | 'dp'>('rs');

  state = inject(RegionStateService);
  serial = inject(SerializationService);

  ngOnInit() {
    // Check for shared URL data
    const shared = this.serial.loadFromUrl();
    if (shared) {
      this.state.loadRegion(shared);
      // Clear the URL param to avoid re-loading on refresh
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  onModeChange(mode: AppMode) {
    this.mode.set(mode);
  }

  openNewRegionDialog() {
    this.newName.set('My Region');
    this.newWidth.set(80);
    this.newHeight.set(60);
    this.newStyle.set('rs');
    this.showNewRegionDialog.set(true);
  }

  createRegion() {
    const name = this.newName().trim() || 'My Region';
    const w = Math.min(200, Math.max(20, this.newWidth()));
    const h = Math.min(200, Math.max(20, this.newHeight()));
    this.state.createNewRegion(name, w, h, this.newStyle());
    this.showNewRegionDialog.set(false);
    this.mode.set('map');
  }

  onCanvasExportRequest() {
    this.mapMaker?.exportMap();
  }
}
