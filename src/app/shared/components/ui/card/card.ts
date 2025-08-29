import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.html',
  styleUrl: './card.scss'
})
export class UiCardComponent {
  @Input() variant: 'default' | 'elevated' | 'outlined' = 'default';
  @Input() padding: 'none' | 'sm' | 'md' | 'lg' = 'lg';
  @Input() clickable = false;

  // CSS クラスを動的生成
  get cardClasses() {
    return {
      'ui-card': true,
      [`ui-card--${this.variant}`]: true,
      [`ui-card--padding-${this.padding}`]: true,
      'ui-card--clickable': this.clickable
    };
  }
}