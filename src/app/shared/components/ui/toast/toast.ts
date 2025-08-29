import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

@Component({
  selector: 'ui-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.scss'
})
export class UiToastComponent implements OnInit, OnDestroy {
  @Input() variant: ToastVariant = 'info';
  @Input() title = '';
  @Input() closable = true;
  @Input() duration = 5000; // 5秒でオートクローズ（0で無効）
  @Input() isVisible = true;
  
  @Output() closed = new EventEmitter<void>();
  
  private autoCloseTimer?: number;
  
  ngOnInit() {
    if (this.duration > 0) {
      this.startAutoClose();
    }
  }
  
  ngOnDestroy() {
    this.clearAutoClose();
  }
  
  close() {
    this.isVisible = false;
    setTimeout(() => {
      this.closed.emit();
    }, 150); // アニメーション時間待ち
  }
  
  private startAutoClose() {
    this.autoCloseTimer = window.setTimeout(() => {
      this.close();
    }, this.duration);
  }
  
  private clearAutoClose() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = undefined;
    }
  }
  
  // ホバー時の自動クローズ停止
  onMouseEnter() {
    this.clearAutoClose();
  }
  
  onMouseLeave() {
    if (this.duration > 0) {
      this.startAutoClose();
    }
  }
  
  // バリアントに応じたアイコンを取得
  get variantIcon() {
    switch (this.variant) {
      case 'success':
        return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'warning':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z';
      case 'error':
        return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
      default: // info
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }
  
  // CSS クラスを動的生成
  get toastClasses() {
    return {
      'ui-toast': true,
      [`ui-toast--${this.variant}`]: true,
      'ui-toast--visible': this.isVisible
    };
  }
}