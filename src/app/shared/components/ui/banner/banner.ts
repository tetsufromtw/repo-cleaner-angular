import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BannerVariant = 'announce' | 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'ui-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './banner.html',
  styleUrl: './banner.scss'
})
export class UiBannerComponent {
  @Input() variant: BannerVariant = 'announce';
  @Input() closable = false;
  @Input() centered = false;
  
  @Output() closed = new EventEmitter<void>();
  
  close() {
    this.closed.emit();
  }
  
  // CSS クラスを動的生成
  get bannerClasses() {
    return {
      'ui-banner': true,
      [`ui-banner--${this.variant}`]: true,
      'ui-banner--centered': this.centered
    };
  }
}