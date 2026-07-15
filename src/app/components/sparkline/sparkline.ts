import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sparkline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg [attr.width]="width" [attr.height]="height" [attr.viewBox]="'0 0 ' + width + ' ' + height" style="display: block; overflow: visible;">
      @if (points.length > 1) {
        <path [attr.d]="pathD" fill="none" [attr.stroke]="color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        
        <!-- Optional gradient fill for aesthetics -->
        <defs>
          <linearGradient [id]="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="color" stop-opacity="0.2"/>
            <stop offset="100%" [attr.stop-color]="color" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path [attr.d]="pathDFill" [attr.fill]="'url(#' + gradientId + ')'" />
      }
    </svg>
  `,
  styles: [`
    :host {
      display: inline-block;
      vertical-align: middle;
    }
  `]
})
export class SparklineComponent implements OnChanges {
  @Input() data: number[] = [];
  @Input() width: number = 80;
  @Input() height: number = 24;

  pathD: string = '';
  pathDFill: string = '';
  color: string = '#94a3b8'; // Default gray
  points: {x: number, y: number}[] = [];
  gradientId: string = 'sparkline-grad-' + Math.random().toString(36).substring(2, 9);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data) {
      this.draw();
    }
  }

  private draw() {
    if (!this.data || this.data.length < 2) {
      this.points = [];
      this.pathD = '';
      this.pathDFill = '';
      return;
    }

    const min = Math.min(...this.data);
    const max = Math.max(...this.data);
    const range = max - min || 1; // Prevent division by zero

    const len = this.data.length - 1;
    this.points = this.data.map((val, i) => {
      const x = (i / len) * this.width;
      // Y is inverted (0 is top)
      const y = this.height - ((val - min) / range) * this.height;
      return { x, y };
    });

    // Determine color based on trend (first vs last)
    const first = this.data[0];
    const last = this.data[this.data.length - 1];
    
    if (last > first) {
      this.color = '#10b981'; // Green
    } else if (last < first) {
      this.color = '#ef4444'; // Red
    } else {
      this.color = '#94a3b8'; // Gray
    }

    // Generate path
    this.pathD = `M ${this.points[0].x} ${this.points[0].y} ` + 
                 this.points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
                 
    this.pathDFill = this.pathD + ` L ${this.width} ${this.height} L 0 ${this.height} Z`;
  }
}
