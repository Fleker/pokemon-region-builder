import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, effect,
  Input, Output, EventEmitter, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegionStateService } from '../../../services/region-state.service';
import {
  MapData, LayerType, Landmark, LandmarkType,
  TERRAIN_RGB, WATER_COLORS, PATH_COLORS, DEFAULT_BG_COLORS, TERRAIN_SCALE,
} from '../../../models/map.model';

export interface DrawingState {
  activeLayer: LayerType;
  activeTool: 'draw' | 'erase';
  activeTerrainType: number; // 0-4
  /** Terrain brush radius in cell units. 1 = 1-cell radius circle. */
  brushRadius: number;
  pendingLandmarkSize: 1 | 2;
  pendingLandmarkType: LandmarkType;
  backgroundVisible: boolean;
}

@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-canvas.html',
  styleUrl: './map-canvas.css',
})
export class MapCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() drawingState!: DrawingState;
  @Output() landmarkSelected = new EventEmitter<string | null>();
  @Output() exportReady = new EventEmitter<HTMLCanvasElement>();

  state = inject(RegionStateService);

  private ctx!: CanvasRenderingContext2D;
  private cellSize = 20;
  private fittedMapSize = { width: 0, height: 0 };
  private panX = 0;
  private panY = 0;
  private isDrawing = false;
  private isPanning = false;
  private panStart = { x: 0, y: 0, px: 0, py: 0 };
  spaceDown = false;

  // Background image cache
  private bgImage: HTMLImageElement | null = null;
  private bgImageSrc: string | null = null;

  // Offscreen terrain canvas (stays at TERRAIN_SCALE× map resolution)
  private terrainCanvas: HTMLCanvasElement | null = null;
  private terrainCtx: CanvasRenderingContext2D | null = null;
  private terrainGridRef: number[] | null | undefined = undefined; // undefined = never drawn
  private terrainStyleRef: string | null = null;

  // Mouse cursor tracking for terrain brush preview
  private mouseViewport = { x: -1, y: -1 };

  private rafId = 0;
  private initialized = false;
  private resizeObserver!: ResizeObserver;

  constructor() {
    effect(() => {
      const map = this.state.mapData();
      this.loadBgImage(map.background);
      this.scheduleRender();
    });
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { willReadFrequently: false })!;
    this.initialized = true;

    this.resizeObserver = new ResizeObserver(() => this.resizeAndRender());
    this.resizeObserver.observe(canvas.parentElement!);
    this.resizeAndRender();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.rafId);
  }

  // ─── Canvas sizing ──────────────────────────────────────────────────────────

  private resizeAndRender() {
    if (!this.initialized) return;
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement!;
    canvas.width = parent.clientWidth || 800;
    canvas.height = parent.clientHeight || 600;

    // Auto-fit whenever map dimensions change (new region, resize, first load)
    const map = this.state.mapData();
    if (this.fittedMapSize.width !== map.width || this.fittedMapSize.height !== map.height) {
      this.fittedMapSize = { width: map.width, height: map.height };
      this.fitToView(canvas, map);
    }

    this.render();
  }

  private fitToView(canvas: HTMLCanvasElement, map: MapData) {
    const padding = 48;
    const availW = canvas.width - padding * 2;
    const availH = canvas.height - padding * 2;
    this.cellSize = Math.min(40, Math.max(8, Math.floor(Math.min(availW / map.width, availH / map.height))));
    const mapW = map.width * this.cellSize;
    const mapH = map.height * this.cellSize;
    this.panX = (canvas.width - mapW) / 2;
    this.panY = (canvas.height - mapH) / 2;
  }

  private scheduleRender() {
    if (!this.initialized) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => this.render());
  }

  // ─── Background image ───────────────────────────────────────────────────────

  private loadBgImage(src: string | null) {
    if (src === this.bgImageSrc) return;
    this.bgImageSrc = src;
    if (!src) { this.bgImage = null; return; }
    const img = new Image();
    img.onload = () => { this.bgImage = img; this.scheduleRender(); };
    img.src = src;
  }

  // ─── Terrain offscreen canvas ───────────────────────────────────────────────

  /**
   * Maintains a small offscreen canvas at (mapW × TERRAIN_SCALE) × (mapH × TERRAIN_SCALE)
   * pixels. This is then scaled up to the display size with one drawImage call.
   */
  private syncTerrainCanvas(map: MapData) {
    const tW = map.width * TERRAIN_SCALE;
    const tH = map.height * TERRAIN_SCALE;

    // Recreate if size changed
    if (!this.terrainCanvas || this.terrainCanvas.width !== tW || this.terrainCanvas.height !== tH) {
      this.terrainCanvas = document.createElement('canvas');
      this.terrainCanvas.width = tW;
      this.terrainCanvas.height = tH;
      this.terrainCtx = this.terrainCanvas.getContext('2d')!;
      this.terrainGridRef = undefined; // force full redraw
    }

    // Skip if neither grid nor style changed
    if (this.terrainGridRef === map.terrainGrid && this.terrainStyleRef === map.style) return;
    this.terrainGridRef = map.terrainGrid;
    this.terrainStyleRef = map.style;

    const ctx = this.terrainCtx!;

    // Clear to transparent
    ctx.clearRect(0, 0, tW, tH);

    if (!map.terrainGrid) return;

    const imageData = ctx.createImageData(tW, tH);
    const data = imageData.data;
    const rgbs = TERRAIN_RGB[map.style];
    const grid = map.terrainGrid;

    for (let i = 0, len = tW * tH; i < len; i++) {
      const t = grid[i];
      if (t >= 0 && t <= 4) {
        const [r, g, b] = rgbs[t];
        const p = i * 4;
        data[p]     = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  render() {
    if (!this.ctx || !this.initialized) return;
    const canvas = this.canvasRef.nativeElement;
    const map = this.state.mapData();
    const ctx = this.ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(Math.round(this.panX), Math.round(this.panY));

    this.drawWater(ctx, map);
    this.drawBackground(ctx, map); // background image above water
    this.drawTerrain(ctx, map);
    this.drawPaths(ctx, map);
    this.drawLandmarks(ctx, map);
    this.drawGrid(ctx, map);

    ctx.restore();

    // Brush cursor drawn in viewport space (outside pan transform)
    this.drawBrushCursor(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, map: MapData) {
    const w = map.width * this.cellSize;
    const h = map.height * this.cellSize;

    if (this.bgImage && this.drawingState.backgroundVisible) {
      const t = map.backgroundTransform;
      ctx.save();
      ctx.translate(w / 2 + t.offsetX, h / 2 + t.offsetY);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(t.scale, t.scale);
      ctx.drawImage(this.bgImage, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = DEFAULT_BG_COLORS[map.style];
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawTerrain(ctx: CanvasRenderingContext2D, map: MapData) {
    if (!map.terrainGrid) return;
    this.syncTerrainCanvas(map);
    if (!this.terrainCanvas) return;

    ctx.imageSmoothingEnabled = false; // nearest-neighbour keeps pixel-art aesthetic
    ctx.drawImage(
      this.terrainCanvas,
      0, 0,
      map.width * this.cellSize,
      map.height * this.cellSize,
    );
    ctx.imageSmoothingEnabled = true;
  }

  private drawWater(ctx: CanvasRenderingContext2D, map: MapData) {
    ctx.fillStyle = WATER_COLORS[map.style];
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        if (map.cells[row][col].water) {
          ctx.fillRect(col * this.cellSize, row * this.cellSize, this.cellSize, this.cellSize);
        }
      }
    }
  }

  private drawPaths(ctx: CanvasRenderingContext2D, map: MapData) {
    ctx.fillStyle = PATH_COLORS[map.style];
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        if (map.cells[row][col].path) {
          ctx.fillRect(col * this.cellSize, row * this.cellSize, this.cellSize, this.cellSize);
        }
      }
    }
  }

  private drawLandmarks(ctx: CanvasRenderingContext2D, map: MapData) {
    for (const lm of map.landmarks) this.drawOneLandmark(ctx, lm);
  }

  private drawOneLandmark(ctx: CanvasRenderingContext2D, lm: Landmark) {
    const cs = this.cellSize;
    const x = lm.x * cs, y = lm.y * cs;
    const w = lm.width * cs, h = lm.height * cs;

    const isCity = lm.type === 'city' || lm.type === 'town';
    const outer = isCity ? '#3aaa5a' : '#cc2233';
    const inner = isCity ? '#ffe820' : '#2255ee';

    const r = Math.min(4, cs * 0.2);
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, w - 2, h - 2, r);
    ctx.fill();

    ctx.fillStyle = inner;
    const cx = x + w / 2, cy = y + h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.28, 0, Math.PI * 2);
    ctx.fill();

    if (lm.name) {
      const fs = Math.max(9, Math.min(12, cs * 0.55));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(lm.name, cx, y, w * 1.5);
      ctx.shadowBlur = 0;
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D, map: MapData) {
    if (this.cellSize < 6) return;
    const W = map.width * this.cellSize;
    const H = map.height * this.cellSize;

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let c = 0; c <= map.width; c++) {
      ctx.moveTo(c * this.cellSize, 0);
      ctx.lineTo(c * this.cellSize, H);
    }
    for (let r = 0; r <= map.height; r++) {
      ctx.moveTo(0, r * this.cellSize);
      ctx.lineTo(W, r * this.cellSize);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);
  }

  private drawBrushCursor(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.mouseViewport;
    if (x < 0 || !this.drawingState || this.drawingState.activeLayer !== 'terrain') return;

    const r = this.drawingState.brushRadius * this.cellSize;
    ctx.save();
    ctx.strokeStyle = this.drawingState.activeTool === 'erase'
      ? 'rgba(255, 80, 80, 0.85)'
      : 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ─── Mouse events ───────────────────────────────────────────────────────────

  /** Returns position in map pixels (accounting for pan) and fractional cell coords. */
  private canvasPos(e: MouseEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const vx = e.clientX - rect.left;  // viewport x
    const vy = e.clientY - rect.top;   // viewport y
    const mx = vx - this.panX;         // map pixel x
    const my = vy - this.panY;         // map pixel y
    return {
      vx, vy, mx, my,
      col: Math.floor(mx / this.cellSize),
      row: Math.floor(my / this.cellSize),
      worldX: mx / this.cellSize,     // fractional cell coords
      worldY: my / this.cellSize,
    };
  }

  onMouseDown(e: MouseEvent) {
    e.preventDefault();
    if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY, px: this.panX, py: this.panY };
      return;
    }
    if (e.button !== 0) return;

    this.isDrawing = true;
    const pos = this.canvasPos(e);
    this.applyDraw(pos, e.shiftKey);
  }

  onMouseMove(e: MouseEvent) {
    const pos = this.canvasPos(e);
    this.mouseViewport = { x: pos.vx, y: pos.vy };

    if (this.isPanning) {
      this.panX = this.panStart.px + (e.clientX - this.panStart.x);
      this.panY = this.panStart.py + (e.clientY - this.panStart.y);
      this.scheduleRender();
      return;
    }

    // Always redraw cursor when in terrain mode (it moves with the mouse)
    if (this.drawingState?.activeLayer === 'terrain') this.scheduleRender();

    if (!this.isDrawing) return;
    this.applyDraw(pos, e.shiftKey);
  }

  onMouseUp(_e: MouseEvent) {
    this.isDrawing = false;
    this.isPanning = false;
  }

  onMouseLeave(_e: MouseEvent) {
    this.mouseViewport = { x: -1, y: -1 };
    this.isDrawing = false;
    this.isPanning = false;
    if (this.drawingState?.activeLayer === 'terrain') this.scheduleRender();
  }

  onContextMenu(e: MouseEvent) {
    e.preventDefault();
    const pos = this.canvasPos(e);
    this.applyEraseAt(pos);
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const oldSize = this.cellSize;
    this.cellSize = Math.min(40, Math.max(8, this.cellSize + delta * 2));

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ratio = this.cellSize / oldSize;
    this.panX = mx - ratio * (mx - this.panX);
    this.panY = my - ratio * (my - this.panY);
    this.scheduleRender();
  }

  onClick(e: MouseEvent) {
    if (this.drawingState.activeLayer !== 'landmark') return;
    const pos = this.canvasPos(e);
    const lm = this.state.getLandmarkAt(pos.row, pos.col);
    if (lm) this.landmarkSelected.emit(lm.id);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space') { this.spaceDown = true; e.preventDefault(); }
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') this.spaceDown = false;
  }

  // ─── Drawing logic ──────────────────────────────────────────────────────────

  private applyDraw(pos: ReturnType<MapCanvasComponent['canvasPos']>, erase = false) {
    const ds = this.drawingState;
    const map = this.state.mapData();
    const { row, col, worldX, worldY } = pos;

    const doErase = ds.activeTool === 'erase' || erase;

    switch (ds.activeLayer) {
      case 'terrain':
        this.state.setTerrainBrush(
          worldX, worldY,
          ds.brushRadius,
          doErase ? -1 : ds.activeTerrainType,
        );
        break;
      case 'water':
        if (col >= 0 && col < map.width && row >= 0 && row < map.height)
          this.state.setCellWater(row, col, !doErase);
        break;
      case 'path':
        if (col >= 0 && col < map.width && row >= 0 && row < map.height)
          this.state.setCellPath(row, col, !doErase);
        break;
      case 'landmark':
        if (!doErase) this.placeLandmark(row, col, ds);
        else this.eraseLandmarkAt(row, col);
        break;
    }
  }

  private applyEraseAt(pos: ReturnType<MapCanvasComponent['canvasPos']>) {
    const ds = this.drawingState;
    const map = this.state.mapData();
    const { row, col, worldX, worldY } = pos;

    if (col < 0 || col >= map.width || row < 0 || row >= map.height) return;

    switch (ds.activeLayer) {
      case 'terrain':
        this.state.setTerrainBrush(worldX, worldY, ds.brushRadius, -1);
        break;
      case 'water':
        this.state.setCellWater(row, col, false);
        break;
      case 'path':
        this.state.setCellPath(row, col, false);
        break;
      case 'landmark':
        this.eraseLandmarkAt(row, col);
        break;
    }
  }

  private eraseLandmarkAt(row: number, col: number) {
    const lm = this.state.getLandmarkAt(row, col);
    if (lm) this.state.removeLandmark(lm.id);
  }

  private lastLandmarkCell = { row: -1, col: -1 };

  private placeLandmark(row: number, col: number, ds: DrawingState) {
    if (row === this.lastLandmarkCell.row && col === this.lastLandmarkCell.col) return;
    this.lastLandmarkCell = { row, col };

    const map = this.state.mapData();
    const size = ds.pendingLandmarkSize;
    for (let r = row; r < row + size; r++) {
      for (let c = col; c < col + size; c++) {
        if (r >= map.height || c >= map.width) return;
        if (map.cells[r][c].landmarkId) return;
      }
    }
    const id = this.state.addLandmark(col, row, size, size, ds.pendingLandmarkType);
    this.landmarkSelected.emit(id);
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  exportPng() {
    this.exportReady.emit(this.canvasRef.nativeElement);
  }
}
