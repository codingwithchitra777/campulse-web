import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pager.html',
  styleUrl: './pager.css'
})
export class PagerComponent {
  readonly total = input.required<number>();
  readonly limit = input.required<number>();
  readonly offset = input.required<number>();
  readonly offsetChange = output<number>();

  readonly page = computed(() => Math.floor(this.offset() / this.limit()) + 1);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));
  readonly hasPrev = computed(() => this.offset() > 0);
  readonly hasNext = computed(() => this.offset() + this.limit() < this.total());

  prev() {
    if (this.hasPrev()) this.offsetChange.emit(Math.max(0, this.offset() - this.limit()));
  }

  next() {
    if (this.hasNext()) this.offsetChange.emit(this.offset() + this.limit());
  }
}
