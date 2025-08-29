import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.html',
  styleUrl: './button.scss'
})
export class UiButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() fullWidth = false;

  @Output() clicked = new EventEmitter<Event>();

  // クリックイベントハンドラ
  onClick(event: Event) {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }

  // CSS クラスを動的生成
  get buttonClasses() {
    return {
      'ui-button': true,
      [`ui-button--${this.variant}`]: true,
      [`ui-button--${this.size}`]: true,
      'ui-button--disabled': this.disabled || this.loading,
      'ui-button--loading': this.loading,
      'ui-button--full-width': this.fullWidth
    };
  }
}
