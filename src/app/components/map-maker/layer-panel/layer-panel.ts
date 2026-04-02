import { Component, Input, Output, EventEmitter, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegionStateService } from '../../../services/region-state.service';
import { LayerType, LandmarkType, TERRAIN_LABELS, TERRAIN_COLORS, LANDMARK_TYPE_LABELS } from '../../../models/map.model';
import { DrawingState } from '../map-canvas/map-canvas';

@Component({
  selector: 'app-layer-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './layer-panel.html',
  styleUrl: './layer-panel.css',
})
export class LayerPanelComponent {
  @Input() drawingState!: DrawingState;
  @Output() drawingStateChange = new EventEmitter<DrawingState>();

  state = inject(RegionStateService);

  pendingWidth = signal(80);
  pendingHeight = signal(60);
  private lastSyncedW = 0;
  private lastSyncedH = 0;

  constructor() {
    effect(() => {
      const map = this.state.mapData();
      if (map.width !== this.lastSyncedW || map.height !== this.lastSyncedH) {
        this.lastSyncedW = map.width;
        this.lastSyncedH = map.height;
        this.pendingWidth.set(map.width);
        this.pendingHeight.set(map.height);
      }
    });
  }

  resizeMap() {
    const w = Math.max(20, Math.min(300, this.pendingWidth()));
    const h = Math.max(20, Math.min(300, this.pendingHeight()));
    this.state.resizeMap(w, h);
  }

  readonly layers: { id: LayerType; label: string; icon: string }[] = [
    { id: 'background', label: 'Background', icon: '🖼' },
    { id: 'water', label: 'Water', icon: '🌊' },
    { id: 'terrain', label: 'Terrain', icon: '🌿' },
    { id: 'path', label: 'Paths', icon: '🛣' },
    { id: 'landmark', label: 'Landmarks', icon: '🏙' },
  ];

  readonly terrainLabels = TERRAIN_LABELS;
  readonly terrainColors = TERRAIN_COLORS;
  readonly landmarkTypes: LandmarkType[] = ['city', 'town', 'route', 'cave', 'special'];
  readonly landmarkTypeLabels = LANDMARK_TYPE_LABELS;

  layerVisible: Record<LayerType, boolean> = {
    background: true, water: true, terrain: true, path: true, landmark: true,
  };

  bgFileInput: HTMLInputElement | null = null;

  setActiveLayer(layer: LayerType) {
    this.emit({ ...this.drawingState, activeLayer: layer });
  }

  setTool(tool: 'draw' | 'erase') {
    this.emit({ ...this.drawingState, activeTool: tool });
  }

  setTerrainType(t: number) {
    this.emit({ ...this.drawingState, activeTerrainType: t });
  }

  setBrushRadius(r: number) {
    this.emit({ ...this.drawingState, brushRadius: r });
  }

  readonly brushPresets: { label: string; r: number }[] = [
    { label: 'XS', r: 0.6 },
    { label: 'S',  r: 1.2 },
    { label: 'M',  r: 2.0 },
    { label: 'L',  r: 3.5 },
    { label: 'XL', r: 5.5 },
  ];

  setLandmarkSize(size: 1 | 2) {
    this.emit({ ...this.drawingState, pendingLandmarkSize: size });
  }

  setLandmarkType(type: LandmarkType) {
    this.emit({ ...this.drawingState, pendingLandmarkType: type });
  }

  setMapStyle(style: 'rs' | 'dp') {
    this.state.setMapStyle(style);
  }

  toggleBackgroundVisible() {
    this.emit({ ...this.drawingState, backgroundVisible: !this.drawingState.backgroundVisible });
  }

  uploadBackground() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.state.setBackground(ev.target?.result as string ?? null);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  clearBackground() {
    this.state.setBackground(null);
  }

  updateBgTransform(key: 'offsetX' | 'offsetY' | 'scale' | 'rotation', value: number) {
    this.state.setBackgroundTransform({ [key]: value });
  }

  private emit(ds: DrawingState) {
    this.drawingStateChange.emit(ds);
  }

  get bgTransform() {
    return this.state.mapData().backgroundTransform;
  }

  get mapStyle() {
    return this.state.mapData().style;
  }

  terrainColor(idx: number): string {
    return this.terrainColors[this.mapStyle][idx];
  }
}
