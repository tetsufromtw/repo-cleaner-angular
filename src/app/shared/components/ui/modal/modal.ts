import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.html',
  styleUrl: './modal.scss'
})
export class UiModalComponent implements AfterViewInit, OnDestroy {
  @Input() isOpen = false;
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() closable = true;
  @Input() closeOnBackdrop = true;
  @Input() title = '';
  
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();
  
  @ViewChild('modal', { static: false }) modalRef!: ElementRef<HTMLDivElement>;
  @ViewChild('closeButton', { static: false }) closeButtonRef!: ElementRef<HTMLButtonElement>;
  
  private previouslyFocusedElement: HTMLElement | null = null;
  private focusableElements: HTMLElement[] = [];
  
  ngAfterViewInit() {
    if (this.isOpen) {
      this.setupFocusTrap();
    }
  }
  
  ngOnDestroy() {
    this.restoreFocus();
  }
  
  ngOnChanges() {
    if (this.isOpen) {
      this.setupFocusTrap();
    } else {
      this.restoreFocus();
    }
  }
  
  // ESC キーでモーダルを閉じる
  @HostListener('keydown.escape')
  onEscape() {
    if (this.closable) {
      this.close();
    }
  }
  
  // バックドロップクリックでモーダルを閉じる
  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget && this.closeOnBackdrop && this.closable) {
      this.close();
    }
  }
  
  // モーダルを閉じる
  close() {
    if (this.closable) {
      this.closed.emit();
    }
  }
  
  // 確認ボタン（必要に応じて）
  confirm() {
    this.confirmed.emit();
  }
  
  // フォーカストラップの設定
  private setupFocusTrap() {
    if (!this.modalRef?.nativeElement) return;
    
    // 現在のフォーカス要素を保存
    this.previouslyFocusedElement = document.activeElement as HTMLElement;
    
    // フォーカス可能な要素を取得
    this.updateFocusableElements();
    
    // 最初の要素にフォーカス
    setTimeout(() => {
      if (this.closeButtonRef?.nativeElement) {
        this.closeButtonRef.nativeElement.focus();
      } else if (this.focusableElements.length > 0) {
        this.focusableElements[0].focus();
      }
    });
  }
  
  // フォーカス可能な要素を更新
  private updateFocusableElements() {
    if (!this.modalRef?.nativeElement) return;
    
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
    
    this.focusableElements = Array.from(
      this.modalRef.nativeElement.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];
  }
  
  // Tab キーナビゲーション管理
  @HostListener('keydown.tab', ['$event'])
  onTab(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.isOpen || this.focusableElements.length === 0) return;
    
    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement;
    
    if (keyboardEvent.shiftKey) {
      // Shift + Tab
      if (activeElement === firstElement) {
        keyboardEvent.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (activeElement === lastElement) {
        keyboardEvent.preventDefault();
        firstElement.focus();
      }
    }
  }
  
  // 前のフォーカスを復元
  private restoreFocus() {
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
      this.previouslyFocusedElement = null;
    }
  }
  
  // CSS クラスを動的生成
  get modalClasses() {
    return {
      'ui-modal': true,
      'ui-modal--open': this.isOpen,
      [`ui-modal--${this.size}`]: true
    };
  }
}