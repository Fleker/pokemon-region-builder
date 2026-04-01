import { Component, ViewChild, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayerPanelComponent } from './layer-panel/layer-panel';
import { MapCanvasComponent, DrawingState } from './map-canvas/map-canvas';
import { LandmarkEditorComponent } from './landmark-editor/landmark-editor';
import { SerializationService } from '../../services/serialization.service';

const DEFAULT_DRAWING_STATE: DrawingState = {
  activeLayer: 'terrain',
  activeTool: 'draw',
  activeTerrainType: 0,
  brushRadius: 1.5,
  pendingLandmarkSize: 1,
  pendingLandmarkType: 'town',
};

@Component({
  selector: 'app-map-maker',
  standalone: true,
  imports: [CommonModule, LayerPanelComponent, MapCanvasComponent, LandmarkEditorComponent],
  templateUrl: './map-maker.html',
  styleUrl: './map-maker.css',
})
export class MapMakerComponent {
  @ViewChild(MapCanvasComponent) canvasComp!: MapCanvasComponent;

  drawingState = signal<DrawingState>({ ...DEFAULT_DRAWING_STATE });
  selectedLandmarkId = signal<string | null>(null);

  serial = inject(SerializationService);

  onDrawingStateChange(ds: DrawingState) {
    this.drawingState.set(ds);
  }

  onLandmarkSelected(id: string | null) {
    this.selectedLandmarkId.set(id);
  }

  onLandmarkEditorClosed() {
    this.selectedLandmarkId.set(null);
  }

  onExportReady(canvas: HTMLCanvasElement) {
    this.serial.exportMapPng(canvas);
  }

  exportMap() {
    this.canvasComp?.exportPng();
  }
}
