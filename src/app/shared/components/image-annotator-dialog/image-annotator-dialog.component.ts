import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

type AnnotatorTool = 'pan' | 'draw' | 'text';

interface TextStamp {
  x: number;
  y: number;
  text: string;
}

@Component({
  selector: 'app-image-annotator-dialog',
  imports: [FormsModule, ButtonModule, InputTextModule],
  templateUrl: './image-annotator-dialog.component.html',
  styleUrl: './image-annotator-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageAnnotatorDialogComponent {
  readonly imageUrl = input.required<string>();
  readonly title = input('Chart screenshot');
  readonly saved = output<File>();
  readonly closed = output<void>();

  protected readonly tool = signal<AnnotatorTool>('draw');
  protected readonly strokeColor = signal('#34d399');
  protected readonly scale = signal(1);
  protected readonly translateX = signal(0);
  protected readonly translateY = signal(0);
  protected readonly textInput = signal('');
  protected readonly pendingTextPoint = signal<{ x: number; y: number } | null>(null);

  protected readonly toolOptions = [
    { label: 'Pan', value: 'pan' as const, icon: 'pi pi-arrows-alt' },
    { label: 'Draw', value: 'draw' as const, icon: 'pi pi-pencil' },
    { label: 'Text', value: 'text' as const, icon: 'pi pi-font' },
  ];

  protected readonly colorOptions = ['#34d399', '#f87171', '#fbbf24', '#ffffff', '#60a5fa'];

  private readonly viewportRef = viewChild<ElementRef<HTMLElement>>('viewport');
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly imageRef = viewChild<ElementRef<HTMLImageElement>>('image');

  private drawing = false;
  private panning = false;
  private lastX = 0;
  private lastY = 0;
  private textStamps: TextStamp[] = [];
  private naturalWidth = 0;
  private naturalHeight = 0;

  protected stageTransform(): string {
    return `translate(${this.translateX()}px, ${this.translateY()}px) scale(${this.scale()})`;
  }

  protected onImageLoad(): void {
    const img = this.imageRef()?.nativeElement;
    const canvas = this.canvasRef()?.nativeElement;
    if (!img || !canvas) {
      return;
    }

    this.naturalWidth = img.naturalWidth;
    this.naturalHeight = img.naturalHeight;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    this.clearCanvas();
  }

  protected setTool(tool: AnnotatorTool): void {
    this.tool.set(tool);
    this.pendingTextPoint.set(null);
  }

  protected setColor(color: string): void {
    this.strokeColor.set(color);
  }

  protected zoomIn(): void {
    this.scale.update((v) => Math.min(v + 0.2, 4));
  }

  protected zoomOut(): void {
    this.scale.update((v) => Math.max(v - 0.2, 0.4));
  }

  protected resetView(): void {
    this.scale.set(1);
    this.translateX.set(0);
    this.translateY.set(0);
  }

  protected undo(): void {
    if (this.textStamps.length === 0) {
      this.clearCanvas();
      return;
    }
    this.textStamps.pop();
    this.clearCanvas();
  }

  protected clearAll(): void {
    this.textStamps = [];
    this.clearCanvas();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    const img = this.imageRef()?.nativeElement;
    const canvas = this.canvasRef()?.nativeElement;
    if (!img || !canvas || !this.naturalWidth || !this.naturalHeight) {
      return;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.naturalWidth;
    exportCanvas.height = this.naturalHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.drawImage(img, 0, 0, this.naturalWidth, this.naturalHeight);
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, this.naturalWidth, this.naturalHeight);

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const file = new File([blob], `annotated-${Date.now()}.png`, { type: 'image/png' });
      this.saved.emit(file);
    }, 'image/png');
  }

  protected onPointerDown(event: PointerEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    const viewport = this.viewportRef()?.nativeElement;
    if (!canvas || !viewport) {
      return;
    }

    if (this.tool() === 'pan') {
      this.panning = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      viewport.setPointerCapture(event.pointerId);
      return;
    }

    const point = this.canvasPoint(event, canvas);
    if (this.tool() === 'draw') {
      this.drawing = true;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.strokeStyle = this.strokeColor();
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      viewport.setPointerCapture(event.pointerId);
      return;
    }

    if (this.tool() === 'text') {
      this.pendingTextPoint.set(point);
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.panning) {
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.translateX.update((x) => x + dx);
      this.translateY.update((y) => y + dy);
      return;
    }

    if (!this.drawing) {
      return;
    }

    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }

    const point = this.canvasPoint(event, canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  protected onPointerUp(event: PointerEvent): void {
    this.drawing = false;
    this.panning = false;
    this.viewportRef()?.nativeElement.releasePointerCapture(event.pointerId);
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    this.scale.update((v) => Math.min(Math.max(v + delta, 0.4), 4));
  }

  protected applyTextStamp(): void {
    const point = this.pendingTextPoint();
    const text = this.textInput().trim();
    const canvas = this.canvasRef()?.nativeElement;
    if (!point || !text || !canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.font = '16px sans-serif';
    ctx.fillStyle = this.strokeColor();
    ctx.fillText(text, point.x, point.y);
    this.textStamps.push({ ...point, text });
    this.textInput.set('');
    this.pendingTextPoint.set(null);
  }

  protected cancelTextStamp(): void {
    this.pendingTextPoint.set(null);
    this.textInput.set('');
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.pendingTextPoint()) {
      this.cancelTextStamp();
      return;
    }
    this.close();
  }

  private canvasPoint(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  private clearCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }
}
