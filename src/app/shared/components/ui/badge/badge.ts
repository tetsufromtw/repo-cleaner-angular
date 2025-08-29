import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
export type BadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.html',
  styleUrl: './badge.scss'
})
export class UiBadgeComponent {
  @Input() variant: BadgeVariant = 'default';
  @Input() size: BadgeSize = 'md';
  @Input() outlined = false;
  @Input() rounded = false;

  // CSS クラスを動的生成
  get badgeClasses() {
    return {
      'ui-badge': true,
      [`ui-badge--${this.variant}`]: true,
      [`ui-badge--${this.size}`]: true,
      'ui-badge--outlined': this.outlined,
      'ui-badge--rounded': this.rounded
    };
  }
}