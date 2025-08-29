import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer, of } from 'rxjs';
import { map, catchError, retry, mergeMap, delay, tap } from 'rxjs/operators';

import {
  GitHubRepository,
  GitHubUser,
  GitHubListResponse,
  GitHubApiError,
  RateLimit,
  GitHubApiOptions,
  ListRepositoriesOptions,
  BatchOperationResult,
  RepositoryOperation
} from './github-types';

@Injectable({
  providedIn: 'root'
})
export class GitHubService {
  private readonly http = inject(HttpClient);
  private readonly baseURL = 'https://api.github.com';
  
  private token: string = '';
  private rateLimitInfo: RateLimit | null = null;
  private readonly STORAGE_KEY = 'github_repo_cleaner_token';
  
  constructor() {
    // サービス初期化時にlocalStorageからトークンを復元
    this.loadTokenFromStorage();
  }
  
  // PAT トークンを設定
  setToken(token: string): void {
    this.token = token;
    this.saveTokenToStorage(token);
    console.log(`💾 [SERVICE] Token saved to localStorage`);
  }
  
  // トークンをクリア
  clearToken(): void {
    this.token = '';
    this.rateLimitInfo = null;
    this.removeTokenFromStorage();
    console.log(`🗑️ [SERVICE] Token cleared from localStorage`);
  }
  
  // 認証状態チェック
  isAuthenticated(): boolean {
    return Boolean(this.token);
  }
  
  // 現在のレート制限情報を取得
  getRateLimit(): RateLimit | null {
    return this.rateLimitInfo;
  }
  
  // トークンを取得
  getToken(): string {
    return this.token;
  }
  
  // トークンをlocalStorageに保存
  private saveTokenToStorage(token: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, token);
    } catch (error) {
      console.warn('Failed to save token to localStorage:', error);
    }
  }
  
  // トークンをlocalStorageから読み込み
  private loadTokenFromStorage(): void {
    try {
      const storedToken = localStorage.getItem(this.STORAGE_KEY);
      if (storedToken) {
        this.token = storedToken;
        console.log(`🔄 [SERVICE] Token restored from localStorage`);
      }
    } catch (error) {
      console.warn('Failed to load token from localStorage:', error);
    }
  }
  
  // トークンをlocalStorageから削除
  private removeTokenFromStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to remove token from localStorage:', error);
    }
  }
  
  /**
   * 認証ユーザー情報を取得
   */
  getCurrentUser(): Observable<GitHubUser> {
    return this.makeRequest<GitHubUser>('/user');
  }
  
  /**
   * トークン検証
   */
  validateToken(): Observable<boolean> {
    return this.getCurrentUser().pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
  
  /**
   * リポジトリ一覧を取得
   */
  listRepositories(options: ListRepositoriesOptions = {}): Observable<GitHubRepository[]> {
    const params = this.buildRepositoryParams(options);
    const url = `/user/repos?${params}`;
    
    return this.makeRequest<GitHubRepository[]>(url).pipe(
      map(repos => repos.map(repo => this.normalizeRepository(repo)))
    );
  }
  
  /**
   * 全リポジトリを取得（ページネーション対応）
   */
  getAllRepositories(): Observable<GitHubRepository[]> {
    return this.fetchAllPages('/user/repos', {
      type: 'owner',
      sort: 'updated',
      per_page: 100
    }).pipe(
      map(repos => repos.map(repo => this.normalizeRepository(repo)))
    );
  }
  
  /**
   * リポジトリをアーカイブ
   */
  archiveRepository(owner: string, repo: string): Observable<GitHubRepository> {
    const url = `/repos/${owner}/${repo}`;
    const body = { archived: true };
    
    return this.makeRequest<GitHubRepository>(url, {
      method: 'PATCH',
      body
    });
  }
  
  /**
   * リポジトリのアーカイブを解除
   */
  unarchiveRepository(owner: string, repo: string): Observable<GitHubRepository> {
    const url = `/repos/${owner}/${repo}`;
    const body = { archived: false };
    
    return this.makeRequest<GitHubRepository>(url, {
      method: 'PATCH',
      body
    });
  }
  
  /**
   * リポジトリを削除
   */
  deleteRepository(owner: string, repo: string): Observable<void> {
    const url = `/repos/${owner}/${repo}`;
    
    console.log(`🗑️ [DELETE] Attempting to delete repository: ${owner}/${repo}`);
    console.log(`🗑️ [DELETE] Full URL: ${this.baseURL}${url}`);
    console.log(`🗑️ [DELETE] Token exists: ${Boolean(this.token)}`);
    console.log(`🗑️ [DELETE] Token starts with: ${this.token.substring(0, 10)}...`);
    
    return this.makeRequest<void>(url, {
      method: 'DELETE'
    }).pipe(
      tap({
        next: (result) => {
          console.log(`✅ [DELETE] Successfully deleted repository: ${owner}/${repo}`, result);
        },
        error: (error) => {
          console.error(`❌ [DELETE] Failed to delete repository: ${owner}/${repo}`, error);
          console.error(`❌ [DELETE] Error status: ${error?.status}`);
          console.error(`❌ [DELETE] Error message: ${error?.message}`);
          console.error(`❌ [DELETE] Full error:`, error);
        }
      })
    );
  }
  
  /**
   * バッチ操作（複数リポジトリに対する一括処理）
   */
  batchOperation(
    repositories: GitHubRepository[],
    operation: RepositoryOperation,
    concurrency = 2
  ): Observable<BatchOperationResult> {
    const results: BatchOperationResult = {
      success: [],
      errors: [],
      total: repositories.length,
      completed: 0,
      remaining: repositories.length
    };
    
    // 同時実行数を制限したパラレル処理
    return new Observable(observer => {
      let completed = 0;
      let running = 0;
      let index = 0;
      
      const processNext = () => {
        while (running < concurrency && index < repositories.length) {
          const repo = repositories[index++];
          running++;
          
          this.executeSingleOperation(repo, operation).subscribe({
            next: (result) => {
              if (result) {
                results.success.push(result);
              }
              completed++;
              running--;
              results.completed++;
              results.remaining--;
              
              // 進捗を通知
              observer.next({
                ...results
              });
              
              if (completed === repositories.length) {
                observer.complete();
              } else {
                processNext();
              }
            },
            error: (error) => {
              results.errors.push({
                repository: repo,
                error: error.message || 'Unknown error'
              });
              completed++;
              running--;
              results.completed++;
              results.remaining--;
              
              // 進捗を通知
              observer.next({
                ...results
              });
              
              if (completed === repositories.length) {
                observer.complete();
              } else {
                processNext();
              }
            }
          });
        }
      };
      
      processNext();
    });
  }
  
  /**
   * 単一リポジトリ操作の実行
   */
  private executeSingleOperation(
    repo: GitHubRepository,
    operation: RepositoryOperation
  ): Observable<GitHubRepository | null> {
    const [owner, name] = repo.full_name.split('/');
    
    // レート制限チェック
    if (this.rateLimitInfo && this.rateLimitInfo.remaining < 10) {
      const resetTime = this.rateLimitInfo.reset * 1000;
      const waitTime = resetTime - Date.now() + 1000; // 1秒バッファ
      
      if (waitTime > 0) {
        return timer(waitTime).pipe(
          mergeMap(() => this.executeSingleOperation(repo, operation))
        );
      }
    }
    
    switch (operation.type) {
      case 'archive':
        return repo.archived ? of(null) : this.archiveRepository(owner, name);
      case 'unarchive':
        return !repo.archived ? of(null) : this.unarchiveRepository(owner, name);
      case 'delete':
        return this.deleteRepository(owner, name).pipe(map(() => repo));
      default:
        return throwError(() => new Error(`Unknown operation: ${operation.type}`));
    }
  }
  
  /**
   * HTTP リクエストを実行（共通処理）
   */
  private makeRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Observable<T> {
    if (!this.token) {
      return throwError(() => new Error('GitHub token is required'));
    }
    
    const { method = 'GET', body, headers: customHeaders = {} } = options;
    const url = `${this.baseURL}${endpoint}`;
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...customHeaders
    });
    
    let request: Observable<any>;
    
    switch (method) {
      case 'GET':
        request = this.http.get(url, { headers, observe: 'response' });
        break;
      case 'POST':
        request = this.http.post(url, body, { headers, observe: 'response' });
        break;
      case 'PATCH':
        request = this.http.patch(url, body, { headers, observe: 'response' });
        break;
      case 'DELETE':
        request = this.http.delete(url, { headers, observe: 'response' });
        break;
    }
    
    return request.pipe(
      map(response => {
        // レート制限情報を更新
        this.updateRateLimitInfo(response.headers);
        return response.body;
      }),
      retry({
        count: 3,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          // 403 (Rate limit) の場合は指数バックオフ
          if (error.status === 403) {
            const backoffTime = Math.pow(2, retryCount) * 1000;
            return timer(backoffTime);
          }
          // その他のエラーは即座にリトライ
          return timer(1000);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }
  
  /**
   * 全ページを取得（ページネーション対応）
   */
  private fetchAllPages<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Observable<T[]> {
    const results: T[] = [];
    const fetchPage = (page = 1): Observable<T[]> => {
      const pageParams = { ...params, page: page.toString(), per_page: '100' };
      const queryString = new URLSearchParams(pageParams as Record<string, string>).toString();
      const url = `${endpoint}?${queryString}`;
      
      return this.makeRequest<T[]>(url).pipe(
        mergeMap(data => {
          results.push(...data);
          
          // 次のページがある場合は再帰的に取得
          if (data.length === 100) {
            return fetchPage(page + 1);
          } else {
            return of(results);
          }
        })
      );
    };
    
    return fetchPage();
  }
  
  /**
   * リポジトリ取得パラメータを構築
   */
  private buildRepositoryParams(options: ListRepositoriesOptions): string {
    const params = new URLSearchParams();
    
    if (options.type) params.append('type', options.type);
    if (options.sort) params.append('sort', options.sort);
    if (options.direction) params.append('direction', options.direction);
    if (options.per_page) params.append('per_page', options.per_page.toString());
    if (options.page) params.append('page', options.page.toString());
    if (options.since) params.append('since', options.since);
    if (options.before) params.append('before', options.before);
    
    return params.toString();
  }
  
  /**
   * リポジトリデータの正規化
   */
  private normalizeRepository(repo: any): GitHubRepository {
    return {
      ...repo,
      // GitHub API の不整合を修正
      watchers_count: repo.watchers_count || repo.watchers || 0,
      stargazers_count: repo.stargazers_count || repo.stargazers || 0,
      forks_count: repo.forks_count || repo.forks || 0,
      topics: repo.topics || []
    };
  }
  
  /**
   * レート制限情報を更新
   */
  private updateRateLimitInfo(headers: any): void {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const used = headers.get('x-ratelimit-used');
    const resource = headers.get('x-ratelimit-resource');
    
    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
        used: parseInt(used || '0', 10),
        resource: resource || 'core'
      };
    }
  }
  
  /**
   * エラーハンドリング
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An error occurred';
    let status = error.status;
    
    if (error.error) {
      if (typeof error.error === 'string') {
        message = error.error;
      } else if (error.error.message) {
        message = error.error.message;
      }
    }
    
    // 特定のエラーコードに対する詳細メッセージ
    switch (status) {
      case 401:
        message = 'Invalid or expired GitHub token';
        break;
      case 403:
        if (message.includes('rate limit')) {
          message = 'GitHub API rate limit exceeded. Please wait before trying again.';
        } else {
          message = 'Insufficient permissions. Please check your token permissions.';
        }
        break;
      case 404:
        message = 'Repository not found or you don\'t have access to it';
        break;
      case 422:
        message = 'Invalid request. Please check your input.';
        break;
    }
    
    const apiError: GitHubApiError = new Error(message) as GitHubApiError;
    apiError.status = status;
    apiError.response = {
      data: error.error,
      status: status,
      headers: error.headers as any
    };
    
    return throwError(() => apiError);
  }
}