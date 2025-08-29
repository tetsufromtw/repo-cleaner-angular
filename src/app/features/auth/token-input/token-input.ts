import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { GitHubService } from '../../../data-access';
import { UiButtonComponent, UiCardComponent, UiBannerComponent } from '../../../shared/components/ui';

@Component({
  selector: 'app-token-input',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatIconModule,
    UiButtonComponent,
    UiCardComponent,
    UiBannerComponent
  ],
  templateUrl: './token-input.html',
  styleUrl: './token-input.scss'
})
export class TokenInputComponent {
  private readonly githubService = inject(GitHubService);
  private readonly router = inject(Router);
  
  // 状態管理
  readonly token = signal('');
  readonly isValidating = signal(false);
  readonly error = signal<string | null>(null);
  readonly showToken = signal(false);
  
  // Token 入力ハンドラ
  onTokenInput(value: string) {
    this.token.set(value.trim());
    if (this.error()) {
      this.error.set(null); // エラーをクリア
    }
  }
  
  // Token 表示/非表示切り替え
  toggleTokenVisibility() {
    this.showToken.update(show => !show);
  }
  
  // Token 検証と開始
  async validateAndStart() {
    const tokenValue = this.token();
    
    if (!tokenValue) {
      this.error.set('Please enter your GitHub Personal Access Token');
      return;
    }
    
    // トークン形式の基本検証
    if (!this.isValidTokenFormat(tokenValue)) {
      this.error.set('Invalid token format. Please check your Personal Access Token.');
      return;
    }
    
    try {
      this.isValidating.set(true);
      this.error.set(null);
      
      // GitHub Service にトークンを設定
      this.githubService.setToken(tokenValue);
      
      // トークンを検証
      const isValid = await new Promise<boolean>((resolve) => {
        this.githubService.validateToken().subscribe({
          next: (result) => resolve(result),
          error: () => resolve(false)
        });
      });
      
      if (isValid) {
        // 検証成功 → Repository 一覧画面に遷移
        this.router.navigate(['/repositories']);
      } else {
        this.error.set('Invalid token or insufficient permissions. Please check your Personal Access Token.');
        this.githubService.clearToken();
      }
    } catch (error) {
      console.error('Token validation error:', error);
      this.error.set('Failed to validate token. Please check your internet connection and try again.');
      this.githubService.clearToken();
    } finally {
      this.isValidating.set(false);
    }
  }
  
  // トークンフォーマットの基本検証
  private isValidTokenFormat(token: string): boolean {
    // GitHub PAT の形式チェック
    // Classic: ghp_xxxx (40文字)
    // Fine-grained: github_pat_xxxx (更に長い)
    return (
      (token.startsWith('ghp_') && token.length >= 40) ||
      (token.startsWith('github_pat_') && token.length >= 50)
    );
  }
}
