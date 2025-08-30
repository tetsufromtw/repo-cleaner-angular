import { Injectable, signal, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, startWith, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { GitHubService } from './github.service';
import {
  GitHubRepository,
  RepositoryState,
  RepositoryFilters,
  RepositorySortConfig,
  RateLimit,
  RepositoryOperation,
  BatchOperationResult
} from './github-types';

@Injectable({
  providedIn: 'root'
})
export class RepositoryStore {
  private readonly githubService = inject(GitHubService);
  
  // プライベート状態 (signals)
  private readonly _repositories = signal<GitHubRepository[]>([]);
  private readonly _selectedIds = signal<Set<number>>(new Set());
  private readonly _filters = signal<RepositoryFilters>({});
  private readonly _sortBy = signal<string>('updated_at');
  private readonly _sortDirection = signal<'asc' | 'desc'>('desc');
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _lastFetch = signal<Date | null>(null);
  
  // バッチ操作状態
  private readonly _batchOperation = signal<{
    inProgress: boolean;
    operation: RepositoryOperation | null;
    progress: BatchOperationResult | null;
  }>({
    inProgress: false,
    operation: null,
    progress: null
  });
  
  // 公開読み取り専用 computed signals
  readonly repositories = this._repositories.asReadonly();
  readonly selectedIds = this._selectedIds.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly sortBy = this._sortBy.asReadonly();
  readonly sortDirection = this._sortDirection.asReadonly();
  readonly isLoading = this._loading.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lastFetch = this._lastFetch.asReadonly();
  readonly batchOperation = this._batchOperation.asReadonly();
  
  // フィルタリングされたリポジトリ (computed)
  readonly filteredRepositories = computed(() => {
    const repos = this._repositories();
    const filters = this._filters();
    const sortBy = this._sortBy();
    const sortDirection = this._sortDirection();
    
    let filtered = this.applyFilters(repos, filters);
    filtered = this.applySorting(filtered, { field: sortBy as any, direction: sortDirection });
    
    return filtered;
  });
  
  // 選択されたリポジトリ (computed)
  readonly selectedRepositories = computed(() => {
    const repos = this.filteredRepositories();
    const selectedIds = this._selectedIds();
    
    return repos.filter(repo => selectedIds.has(repo.id));
  });
  
  // 選択統計 (computed)
  readonly selectionStats = computed(() => {
    const selectedRepos = this.selectedRepositories();
    
    return {
      totalSelected: selectedRepos.length,
      totalFiltered: this.filteredRepositories().length,
      totalAll: this._repositories().length,
      
      // 選択されたリポジトリの統計
      selectedStats: {
        private: selectedRepos.filter(r => r.private).length,
        archived: selectedRepos.filter(r => r.archived).length,
        forked: selectedRepos.filter(r => r.fork).length,
        totalStars: selectedRepos.reduce((sum, r) => sum + r.stargazers_count, 0),
        totalSize: selectedRepos.reduce((sum, r) => sum + r.size, 0)
      }
    };
  });
  
  // レート制限情報 (computed)
  readonly rateLimit = computed<RateLimit | null>(() => {
    return this.githubService.getRateLimit();
  });
  
  /**
   * リポジトリ一覧を読み込み
   */
  async loadRepositories(forceRefresh = false): Promise<void> {
    const lastFetch = this._lastFetch();
    const cacheExpiry = 5 * 60 * 1000; // 5分キャッシュ
    
    console.log(`🔄 [STORE] loadRepositories called, forceRefresh: ${forceRefresh}`);
    console.log(`🔄 [STORE] Current repository count: ${this._repositories().length}`);
    
    // キャッシュチェック - 強制リフレッシュの場合はスキップ
    if (!forceRefresh && lastFetch && Date.now() - lastFetch.getTime() < cacheExpiry) {
      console.log(`📦 [STORE] Using cached repositories, skipping refresh`);
      return;
    }
    
    if (forceRefresh) {
      console.log(`🔄 [STORE] Force refresh requested - ignoring cache completely`);
    }
    
    try {
      console.log(`🚀 [STORE] Starting repository refresh...`);
      this._loading.set(true);
      this._error.set(null);
      
      const repositories = await new Promise<any[]>((resolve, reject) => {
        this.githubService.getAllRepositories().subscribe({
          next: (repos) => {
            console.log(`📥 [STORE] Received ${repos?.length || 0} repositories from API`);
            resolve(repos);
          },
          error: (error) => {
            console.error(`❌ [STORE] Error loading repositories:`, error);
            reject(error);
          }
        });
      });
      
      if (repositories) {
        console.log(`💾 [STORE] Updating local repository list with ${repositories.length} items`);
        const previousCount = this._repositories().length;
        this._repositories.set(repositories);
        this._lastFetch.set(new Date());
        console.log(`✅ [STORE] Repository list updated successfully`);
        console.log(`📊 [STORE] Repository count changed: ${previousCount} → ${repositories.length}`);
        
        // 削除されたリポジトリの確認
        if (previousCount > repositories.length) {
          console.log(`🗑️ [STORE] ${previousCount - repositories.length} repositories were successfully removed from list`);
        }
      }
    } catch (error) {
      console.error(`❌ [STORE] Failed to load repositories:`, error);
      this._error.set(error instanceof Error ? error.message : 'Failed to load repositories');
    } finally {
      this._loading.set(false);
      console.log(`🏁 [STORE] loadRepositories completed`);
    }
  }
  
  /**
   * 個別フィルターを設定
   */
  setFilter(key: string, value: any): void {
    this._filters.update(current => ({ ...current, [key]: value }));
  }
  
  /**
   * フィルターを更新
   */
  updateFilters(filters: Partial<RepositoryFilters>): void {
    this._filters.update(current => ({ ...current, ...filters }));
    this.clearSelection(); // フィルター変更時は選択をクリア
  }
  
  /**
   * フィルターをリセット
   */
  resetFilters(): void {
    this._filters.set({});
    this.clearSelection();
  }
  
  /**
   * 全フィルターをクリア
   */
  clearFilters(): void {
    this._filters.set({});
    this.clearSelection();
  }
  
  /**
   * ソート設定を更新
   */
  setSortBy(sortBy: string): void {
    this._sortBy.set(sortBy);
  }
  
  setSortDirection(direction: 'asc' | 'desc'): void {
    this._sortDirection.set(direction);
  }
  
  /**
   * 単一リポジトリの選択切り替え
   */
  toggleSelection(repositoryId: number): void {
    this._selectedIds.update(current => {
      const newSet = new Set(current);
      if (newSet.has(repositoryId)) {
        newSet.delete(repositoryId);
      } else {
        newSet.add(repositoryId);
      }
      return newSet;
    });
  }
  
  /**
   * 複数リポジトリの選択
   */
  selectRepositories(repositoryIds: number[]): void {
    this._selectedIds.update(current => {
      const newSet = new Set(current);
      repositoryIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }
  
  /**
   * 範囲選択（Shift+クリック用）
   */
  selectRange(fromId: number, toId: number): void {
    const filtered = this.filteredRepositories();
    const fromIndex = filtered.findIndex(r => r.id === fromId);
    const toIndex = filtered.findIndex(r => r.id === toId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    
    const rangeIds = filtered.slice(start, end + 1).map(r => r.id);
    this.selectRepositories(rangeIds);
  }
  
  /**
   * 全選択/全解除
   */
  toggleSelectAll(): void {
    const filtered = this.filteredRepositories();
    const current = this._selectedIds();
    
    // 現在表示されているリポジトリがすべて選択されているかチェック
    const allFilteredSelected = filtered.every(repo => current.has(repo.id));
    
    if (allFilteredSelected) {
      // 全解除：フィルタされたリポジトリの選択を解除
      this._selectedIds.update(currentSet => {
        const newSet = new Set(currentSet);
        filtered.forEach(repo => newSet.delete(repo.id));
        return newSet;
      });
    } else {
      // 全選択：フィルタされたリポジトリをすべて選択
      this.selectRepositories(filtered.map(repo => repo.id));
    }
  }
  
  /**
   * 選択をクリア
   */
  clearSelection(): void {
    this._selectedIds.set(new Set());
  }
  
  /**
   * リポジトリが選択されているかチェック
   */
  isSelected(repositoryId: number): boolean {
    return this._selectedIds().has(repositoryId);
  }
  
  /**
   * 条件に基づく自動選択
   */
  selectByCondition(condition: (repo: GitHubRepository) => boolean): void {
    const matching = this.filteredRepositories().filter(condition);
    this.selectRepositories(matching.map(repo => repo.id));
  }
  
  /**
   * バッチ操作を実行
   */
  async executeBatchOperation(operation: RepositoryOperation): Promise<BatchOperationResult> {
    const selectedRepos = this.selectedRepositories();
    
    if (selectedRepos.length === 0) {
      throw new Error('No repositories selected');
    }
    
    this._batchOperation.set({
      inProgress: true,
      operation,
      progress: null
    });
    
    try {
      const result = await new Promise<BatchOperationResult>((resolve, reject) => {
        this.githubService.batchOperation(selectedRepos, operation, 2).subscribe({
          next: (progress) => {
            this._batchOperation.update(current => ({
              ...current,
              progress
            }));
          },
          complete: () => {
            const finalResult = this._batchOperation().progress;
            if (finalResult) {
              resolve(finalResult);
            } else {
              reject(new Error('Batch operation completed without result'));
            }
          },
          error: reject
        });
      });
      
      // 成功した操作に基づいてローカル状態を更新
      console.log(`🔄 [STORE] Batch operation completed. Successful: ${result.success.length}, Errors: ${result.errors.length}`);
      if (result.success.length > 0) {
        if (operation.type === 'delete') {
          // 削除操作の場合は、成功したrepositoryをローカル状態から即座に削除
          console.log(`🗑️ [STORE] Removing successfully deleted repositories from local state...`);
          const successIds = result.success.map(repo => repo.id);
          const currentRepos = this._repositories();
          const updatedRepos = currentRepos.filter(repo => !successIds.includes(repo.id));
          
          console.log(`📊 [STORE] Repository count: ${currentRepos.length} → ${updatedRepos.length} (removed ${successIds.length})`);
          this._repositories.set(updatedRepos);
          
          // 削除したrepositoryの名前をログ出力
          result.success.forEach(repo => {
            console.log(`✅ [STORE] Removed ${repo.full_name} from local state`);
          });
        } else {
          // アーカイブ/アンアーカイブの場合はAPI刷新が必要
          console.log(`🔄 [STORE] Non-delete operation, refreshing from API...`);
          this._lastFetch.set(null);
          await this.loadRepositories(true);
        }
        console.log(`✅ [STORE] Repository list update completed`);
      } else {
        console.log(`⚠️ [STORE] No successful operations, no state update needed`);
      }
      
      // 操作完了後は選択をクリア
      console.log(`🧹 [STORE] Clearing selection after batch operation`);
      this.clearSelection();
      
      return result;
      
    } finally {
      this._batchOperation.set({
        inProgress: false,
        operation: null,
        progress: null
      });
    }
  }
  
  /**
   * エラーをクリア
   */
  clearError(): void {
    this._error.set(null);
  }

  /**
   * 手動でリポジトリリストを刷新
   */
  async refreshRepositories(): Promise<void> {
    console.log(`🔄 [STORE] Manual refresh triggered`);
    this._lastFetch.set(null);
    await this.loadRepositories(true);
  }
  
  /**
   * フィルターを適用
   */
  private applyFilters(repos: GitHubRepository[], filters: RepositoryFilters): GitHubRepository[] {
    return repos.filter(repo => {
      // 名前フィルター
      if (filters.name && !repo.name.toLowerCase().includes(filters.name.toLowerCase())) {
        return false;
      }
      
      // 言語フィルター
      if (filters.language && repo.language !== filters.language) {
        return false;
      }
      
      // ブール値フィルター
      if (filters.starred !== undefined && (repo.stargazers_count > 0) !== filters.starred) {
        return false;
      }
      if (filters.forked !== undefined && repo.fork !== filters.forked) {
        return false;
      }
      if (filters.archived !== undefined && repo.archived !== filters.archived) {
        return false;
      }
      if (filters.private !== undefined && repo.private !== filters.private) {
        return false;
      }
      
      // 数値範囲フィルター
      if (filters.minStars !== undefined && repo.stargazers_count < filters.minStars) {
        return false;
      }
      if (filters.maxStars !== undefined && repo.stargazers_count > filters.maxStars) {
        return false;
      }
      if (filters.minSize !== undefined && repo.size < filters.minSize) {
        return false;
      }
      if (filters.maxSize !== undefined && repo.size > filters.maxSize) {
        return false;
      }
      if (filters.minForks !== undefined && repo.forks_count < filters.minForks) {
        return false;
      }
      if (filters.maxForks !== undefined && repo.forks_count > filters.maxForks) {
        return false;
      }
      
      // 日付フィルター
      if (filters.createdAfter && new Date(repo.created_at) < filters.createdAfter) {
        return false;
      }
      if (filters.createdBefore && new Date(repo.created_at) > filters.createdBefore) {
        return false;
      }
      if (filters.updatedAfter && new Date(repo.updated_at) < filters.updatedAfter) {
        return false;
      }
      if (filters.updatedBefore && new Date(repo.updated_at) > filters.updatedBefore) {
        return false;
      }
      if (filters.pushedAfter && new Date(repo.pushed_at) < filters.pushedAfter) {
        return false;
      }
      if (filters.pushedBefore && new Date(repo.pushed_at) > filters.pushedBefore) {
        return false;
      }
      
      // トピックフィルター
      if (filters.topics && filters.topics.length > 0) {
        const hasRequiredTopics = filters.topics.every(topic =>
          repo.topics.some(repoTopic =>
            repoTopic.toLowerCase().includes(topic.toLowerCase())
          )
        );
        if (!hasRequiredTopics) {
          return false;
        }
      }
      
      if (filters.hasTopics !== undefined) {
        const hasTopics = repo.topics.length > 0;
        if (hasTopics !== filters.hasTopics) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * ソートを適用
   */
  private applySorting(repos: GitHubRepository[], sort: RepositorySortConfig): GitHubRepository[] {
    return [...repos].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sort.field) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'created_at':
        case 'updated_at':
        case 'pushed_at':
          aValue = new Date(a[sort.field]).getTime();
          bValue = new Date(b[sort.field]).getTime();
          break;
        case 'stargazers_count':
        case 'forks_count':
        case 'size':
          aValue = a[sort.field];
          bValue = b[sort.field];
          break;
        default:
          return 0;
      }
      
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      else if (aValue > bValue) comparison = 1;
      
      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }
  
  /**
   * 個別リポジトリの選択
   */
  selectRepository(repositoryId: number): void {
    this._selectedIds.update(current => {
      const newSet = new Set(current);
      newSet.add(repositoryId);
      return newSet;
    });
  }
  
  /**
   * 個別リポジトリの選択解除
   */
  deselectRepository(repositoryId: number): void {
    this._selectedIds.update(current => {
      const newSet = new Set(current);
      newSet.delete(repositoryId);
      return newSet;
    });
  }
  
  /**
   * 全選択解除
   */
  deselectAll(): void {
    this._selectedIds.set(new Set());
  }
  
  /**
   * 単一リポジトリのアーカイブ
   */
  async archiveRepository(repositoryId: number): Promise<void> {
    const result = await this.executeBatchOperation({
      type: 'archive',
      repositoryIds: [repositoryId]
    });
    
    if (result.errors.length > 0) {
      throw new Error(result.errors[0].error);
    }
  }
  
  /**
   * 単一リポジトリのアーカイブ解除
   */
  async unarchiveRepository(repositoryId: number): Promise<void> {
    const result = await this.executeBatchOperation({
      type: 'unarchive', 
      repositoryIds: [repositoryId]
    });
    
    if (result.errors.length > 0) {
      throw new Error(result.errors[0].error);
    }
  }
  
  /**
   * 単一リポジトリの削除
   */
  async deleteRepository(repositoryId: number): Promise<void> {
    console.log(`🗄️ [STORE] deleteRepository called with ID: ${repositoryId}`);
    
    // Find the repository info for logging
    const repo = this._repositories().find(r => r.id === repositoryId);
    if (repo) {
      console.log(`🗄️ [STORE] Found repository: ${repo.owner.login}/${repo.name}`);
    } else {
      console.warn(`⚠️ [STORE] Repository with ID ${repositoryId} not found in local store`);
    }
    
    console.log(`🗄️ [STORE] Calling executeBatchOperation with delete operation`);
    const result = await this.executeBatchOperation({
      type: 'delete',
      repositoryIds: [repositoryId]
    });
    
    console.log(`🗄️ [STORE] Batch operation result:`, result);
    console.log(`🗄️ [STORE] Successful deletions: ${result.success.length}`);
    console.log(`🗄️ [STORE] Failed deletions: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.error(`🗄️ [STORE] Deletion failed with error:`, result.errors[0]);
      throw new Error(result.errors[0].error);
    } else {
      console.log(`✅ [STORE] Repository deletion completed successfully`);
    }
  }
  
  /**
   * バッチアーカイブ
   */
  async batchArchive(repositoryIds: number[]): Promise<void> {
    const result = await this.executeBatchOperation({
      type: 'archive',
      repositoryIds
    });
    
    if (result.errors.length > 0) {
      throw new Error(`${result.errors.length} repositories failed to archive`);
    }
  }
  
  /**
   * バッチアーカイブ解除
   */
  async batchUnarchive(repositoryIds: number[]): Promise<void> {
    const result = await this.executeBatchOperation({
      type: 'unarchive',
      repositoryIds
    });
    
    if (result.errors.length > 0) {
      throw new Error(`${result.errors.length} repositories failed to unarchive`);
    }
  }
  
  /**
   * バッチ削除
   */
  async batchDelete(repositoryIds: number[]): Promise<void> {
    const result = await this.executeBatchOperation({
      type: 'delete',
      repositoryIds
    });
    
    if (result.errors.length > 0) {
      throw new Error(`${result.errors.length} repositories failed to delete`);
    }
  }
}