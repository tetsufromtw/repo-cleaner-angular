import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { RepositoryStore } from './repository.store';
import { GitHubService } from './github.service';
import { GitHubRepository, RepositoryFilters, RepositoryOperation, BatchOperationResult } from './github-types';

describe('RepositoryStore', () => {
  let store: RepositoryStore;
  let mockGitHubService: jasmine.SpyObj<GitHubService>;

  // モックデータの定義
  const mockRepository1: GitHubRepository = {
    id: 1,
    node_id: 'MDEwOlJlcG9zaXRvcnkx',
    name: 'repo-a',
    full_name: 'user/repo-a',
    html_url: 'https://github.com/user/repo-a',
    clone_url: 'https://github.com/user/repo-a.git',
    ssh_url: 'git@github.com:user/repo-a.git',
    description: 'Repository A for testing',
    private: false,
    fork: false,
    archived: false,
    disabled: false,
    language: 'TypeScript',
    stargazers_count: 10,
    watchers_count: 5,
    forks_count: 2,
    open_issues_count: 1,
    size: 1000,
    topics: ['angular', 'typescript'],
    pushed_at: '2023-12-01T10:00:00Z',
    created_at: '2023-01-01T10:00:00Z',
    updated_at: '2023-12-01T10:00:00Z',
    owner: {
      id: 1,
      login: 'user',
      type: 'User',
      avatar_url: 'https://example.com/avatar.jpg',
      html_url: 'https://github.com/user'
    },
    permissions: {
      admin: true,
      push: true,
      pull: true,
      maintain: false,
      triage: false
    }
  };

  const mockRepository2: GitHubRepository = {
    ...mockRepository1,
    id: 2,
    name: 'repo-b',
    full_name: 'user/repo-b',
    html_url: 'https://github.com/user/repo-b',
    description: 'Repository B for testing',
    language: 'JavaScript',
    stargazers_count: 5,
    archived: true,
    private: true,
    topics: ['react', 'javascript'],
    created_at: '2023-02-01T10:00:00Z',
    updated_at: '2023-11-15T08:30:00Z'
  };

  const mockRepository3: GitHubRepository = {
    ...mockRepository1,
    id: 3,
    name: 'repo-c',
    full_name: 'user/repo-c',
    html_url: 'https://github.com/user/repo-c',
    description: 'Repository C for testing',
    language: undefined,
    stargazers_count: 0,
    fork: true,
    topics: [],
    created_at: '2023-03-01T10:00:00Z',
    updated_at: '2023-10-20T14:15:00Z'
  };

  const mockRepositories = [mockRepository1, mockRepository2, mockRepository3];

  beforeEach(() => {
    // GitHubService のモックを作成
    const githubServiceSpy = jasmine.createSpyObj('GitHubService', [
      'getAllRepositories',
      'getRateLimit',
      'batchOperation'
    ]);

    TestBed.configureTestingModule({
      providers: [
        RepositoryStore,
        { provide: GitHubService, useValue: githubServiceSpy }
      ]
    });

    store = TestBed.inject(RepositoryStore);
    mockGitHubService = TestBed.inject(GitHubService) as jasmine.SpyObj<GitHubService>;

    // デフォルトの戻り値を設定
    mockGitHubService.getAllRepositories.and.returnValue(of(mockRepositories));
    mockGitHubService.getRateLimit.and.returnValue(null);
  });

  describe('初期化と基本状態のテスト', () => {
    it('ストアが正常に作成されること', () => {
      expect(store).toBeTruthy();
    });

    it('初期状態が正しく設定されていること', () => {
      expect(store.repositories()).toEqual([]);
      expect(store.selectedIds().size).toBe(0);
      expect(store.filters()).toEqual({});
      expect(store.sortBy()).toBe('updated_at');
      expect(store.sortDirection()).toBe('desc');
      expect(store.isLoading()).toBeFalse();
      expect(store.error()).toBeNull();
      expect(store.lastFetch()).toBeNull();
      expect(store.batchOperation().inProgress).toBeFalse();
    });

    it('filteredRepositories が初期状態で空配列であること', () => {
      expect(store.filteredRepositories()).toEqual([]);
    });

    it('selectedRepositories が初期状態で空配列であること', () => {
      expect(store.selectedRepositories()).toEqual([]);
    });

    it('selectionStats が正しく計算されること', () => {
      const stats = store.selectionStats();
      expect(stats.totalSelected).toBe(0);
      expect(stats.totalFiltered).toBe(0);
      expect(stats.totalAll).toBe(0);
      expect(stats.selectedStats.private).toBe(0);
      expect(stats.selectedStats.archived).toBe(0);
      expect(stats.selectedStats.forked).toBe(0);
      expect(stats.selectedStats.totalStars).toBe(0);
      expect(stats.selectedStats.totalSize).toBe(0);
    });
  });

  describe('リポジトリ読み込み機能のテスト', () => {
    it('リポジトリが正常に読み込まれること', async () => {
      await store.loadRepositories();

      expect(store.repositories()).toEqual(mockRepositories);
      expect(store.isLoading()).toBeFalse();
      expect(store.error()).toBeNull();
      expect(store.lastFetch()).toBeTruthy();
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(1);
    });

    it('読み込みエラーが適切に処理されること', async () => {
      const errorMessage = 'API Error occurred';
      mockGitHubService.getAllRepositories.and.returnValue(throwError(() => new Error(errorMessage)));

      await store.loadRepositories();

      expect(store.repositories()).toEqual([]);
      expect(store.isLoading()).toBeFalse();
      expect(store.error()).toBe(errorMessage);
    });

    it('キャッシュ機能が動作すること', async () => {
      // 最初の読み込み
      await store.loadRepositories();
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(1);

      // キャッシュ有効期間内での再読み込み（API呼び出しなし）
      await store.loadRepositories();
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(1);

      // 強制リフレッシュ（API再呼び出し）
      await store.loadRepositories(true);
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(2);
    });

    it('手動リフレッシュが動作すること', async () => {
      await store.loadRepositories();
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(1);

      await store.refreshRepositories();
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(2);
    });

    it('エラークリア機能が動作すること', async () => {
      mockGitHubService.getAllRepositories.and.returnValue(throwError(() => new Error('Test error')));
      
      await store.loadRepositories();
      expect(store.error()).toBeTruthy();

      store.clearError();
      expect(store.error()).toBeNull();
    });
  });

  describe('フィルタリング機能のテスト', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('名前でフィルタリングできること', () => {
      store.setFilter('name', 'repo-a');
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('repo-a');
    });

    it('言語でフィルタリングできること', () => {
      store.setFilter('language', 'TypeScript');
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(1);
      expect(filtered[0].language).toBe('TypeScript');
    });

    it('スター付きリポジトリでフィルタリングできること', () => {
      store.setFilter('starred', true);
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(2); // repo-a(10 stars) and repo-b(5 stars)
      expect(filtered.every(r => r.stargazers_count > 0)).toBeTrue();
    });

    it('アーカイブ状態でフィルタリングできること', () => {
      store.setFilter('archived', true);
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(1);
      expect(filtered[0].archived).toBeTrue();
    });

    it('プライベートリポジトリでフィルタリングできること', () => {
      store.setFilter('private', true);
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(1);
      expect(filtered[0].private).toBeTrue();
    });

    it('フォークリポジトリでフィルタリングできること', () => {
      store.setFilter('forked', true);
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(1);
      expect(filtered[0].fork).toBeTrue();
    });

    it('スター数の範囲でフィルタリングできること', () => {
      store.updateFilters({ minStars: 5, maxStars: 10 });
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(2); // repo-a(10) and repo-b(5)
      expect(filtered.every(r => r.stargazers_count >= 5 && r.stargazers_count <= 10)).toBeTrue();
    });

    it('トピックでフィルタリングできること', () => {
      store.setFilter('topics', ['angular']);
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(1);
      expect(filtered[0].topics).toContain('angular');
    });

    it('トピック有無でフィルタリングできること', () => {
      store.setFilter('hasTopics', false);
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(1);
      expect(filtered[0].topics.length).toBe(0);
    });

    it('複数のフィルターが同時に適用されること', () => {
      store.updateFilters({
        language: 'TypeScript',
        starred: true,
        private: false
      });
      
      const filtered = store.filteredRepositories();
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('repo-a');
    });

    it('フィルターをクリアできること', () => {
      store.updateFilters({ language: 'TypeScript', starred: true });
      expect(store.filteredRepositories().length).toBe(1);

      store.clearFilters();
      expect(store.filters()).toEqual({});
      expect(store.filteredRepositories().length).toBe(3);
    });

    it('フィルターをリセットできること', () => {
      store.updateFilters({ language: 'JavaScript' });
      store.resetFilters();
      
      expect(store.filters()).toEqual({});
      expect(store.filteredRepositories().length).toBe(3);
    });
  });

  describe('ソート機能のテスト', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('名前で昇順ソートできること', () => {
      store.setSortBy('name');
      store.setSortDirection('asc');
      
      const sorted = store.filteredRepositories();
      expect(sorted[0].name).toBe('repo-a');
      expect(sorted[1].name).toBe('repo-b');
      expect(sorted[2].name).toBe('repo-c');
    });

    it('名前で降順ソートできること', () => {
      store.setSortBy('name');
      store.setSortDirection('desc');
      
      const sorted = store.filteredRepositories();
      expect(sorted[0].name).toBe('repo-c');
      expect(sorted[1].name).toBe('repo-b');
      expect(sorted[2].name).toBe('repo-a');
    });

    it('スター数で降順ソートできること', () => {
      store.setSortBy('stargazers_count');
      store.setSortDirection('desc');
      
      const sorted = store.filteredRepositories();
      expect(sorted[0].stargazers_count).toBe(10); // repo-a
      expect(sorted[1].stargazers_count).toBe(5);  // repo-b
      expect(sorted[2].stargazers_count).toBe(0);  // repo-c
    });

    it('作成日時でソートできること', () => {
      store.setSortBy('created_at');
      store.setSortDirection('asc');
      
      const sorted = store.filteredRepositories();
      expect(new Date(sorted[0].created_at).getTime()).toBeLessThanOrEqual(
        new Date(sorted[1].created_at).getTime()
      );
    });

    it('更新日時でソートできること', () => {
      store.setSortBy('updated_at');
      store.setSortDirection('desc');
      
      const sorted = store.filteredRepositories();
      // repo-a: 2023-12-01, repo-b: 2023-11-15, repo-c: 2023-10-20
      expect(sorted[0].name).toBe('repo-a');
      expect(sorted[1].name).toBe('repo-b');
      expect(sorted[2].name).toBe('repo-c');
    });
  });

  describe('選択機能のテスト', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('単一リポジトリの選択切り替えができること', () => {
      expect(store.isSelected(1)).toBeFalse();
      
      store.toggleSelection(1);
      expect(store.isSelected(1)).toBeTrue();
      expect(store.selectedIds().size).toBe(1);
      
      store.toggleSelection(1);
      expect(store.isSelected(1)).toBeFalse();
      expect(store.selectedIds().size).toBe(0);
    });

    it('複数リポジトリを選択できること', () => {
      store.selectRepositories([1, 2]);
      
      expect(store.isSelected(1)).toBeTrue();
      expect(store.isSelected(2)).toBeTrue();
      expect(store.selectedIds().size).toBe(2);
    });

    it('個別リポジトリを選択できること', () => {
      store.selectRepository(1);
      
      expect(store.isSelected(1)).toBeTrue();
      expect(store.selectedIds().size).toBe(1);
    });

    it('個別リポジトリの選択を解除できること', () => {
      store.selectRepository(1);
      store.deselectRepository(1);
      
      expect(store.isSelected(1)).toBeFalse();
      expect(store.selectedIds().size).toBe(0);
    });

    it('範囲選択ができること', () => {
      store.selectRange(1, 3);
      
      expect(store.selectedIds().size).toBe(3);
      expect(store.isSelected(1)).toBeTrue();
      expect(store.isSelected(2)).toBeTrue();
      expect(store.isSelected(3)).toBeTrue();
    });

    it('全選択・全解除ができること', () => {
      // 全選択
      store.toggleSelectAll();
      expect(store.selectedIds().size).toBe(3);
      expect([1, 2, 3].every(id => store.isSelected(id))).toBeTrue();
      
      // 全解除
      store.toggleSelectAll();
      expect(store.selectedIds().size).toBe(0);
    });

    it('選択をクリアできること', () => {
      store.selectRepositories([1, 2, 3]);
      store.clearSelection();
      
      expect(store.selectedIds().size).toBe(0);
    });

    it('全選択解除ができること', () => {
      store.selectRepositories([1, 2, 3]);
      store.deselectAll();
      
      expect(store.selectedIds().size).toBe(0);
    });

    it('条件に基づく選択ができること', () => {
      store.selectByCondition(repo => repo.stargazers_count > 0);
      
      expect(store.selectedIds().size).toBe(2); // repo-a and repo-b have stars
      expect(store.isSelected(1)).toBeTrue(); // repo-a
      expect(store.isSelected(2)).toBeTrue(); // repo-b
      expect(store.isSelected(3)).toBeFalse(); // repo-c has 0 stars
    });

    it('選択されたリポジトリが正しく computed されること', () => {
      store.selectRepositories([1, 2]);
      
      const selected = store.selectedRepositories();
      expect(selected.length).toBe(2);
      expect(selected.map(r => r.id)).toEqual([1, 2]);
    });

    it('フィルター変更時に選択がクリアされること', () => {
      store.selectRepositories([1, 2]);
      expect(store.selectedIds().size).toBe(2);
      
      store.updateFilters({ language: 'TypeScript' });
      expect(store.selectedIds().size).toBe(0);
    });
  });

  describe('選択統計の計算テスト', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('選択統計が正しく計算されること', () => {
      store.selectRepositories([1, 2]);
      
      const stats = store.selectionStats();
      expect(stats.totalSelected).toBe(2);
      expect(stats.totalFiltered).toBe(3);
      expect(stats.totalAll).toBe(3);
      expect(stats.selectedStats.private).toBe(1); // repo-b is private
      expect(stats.selectedStats.archived).toBe(1); // repo-b is archived
      expect(stats.selectedStats.forked).toBe(0); // neither repo-a nor repo-b is fork
      expect(stats.selectedStats.totalStars).toBe(15); // 10 + 5
      expect(stats.selectedStats.totalSize).toBe(2000); // 1000 + 1000
    });

    it('選択変更時に統計が更新されること', () => {
      store.selectRepository(3); // repo-c: fork, 0 stars
      
      const stats = store.selectionStats();
      expect(stats.totalSelected).toBe(1);
      expect(stats.selectedStats.forked).toBe(1);
      expect(stats.selectedStats.totalStars).toBe(0);
    });

    it('フィルター適用時の統計が正しいこと', () => {
      store.setFilter('language', 'TypeScript');
      store.selectRepository(1); // repo-a のみがフィルターを通過
      
      const stats = store.selectionStats();
      expect(stats.totalSelected).toBe(1);
      expect(stats.totalFiltered).toBe(1);
      expect(stats.totalAll).toBe(3);
    });
  });

  describe('バッチ操作のテスト', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('バッチ操作が正常に実行されること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepository(1);

      const operation: RepositoryOperation = {
        type: 'archive',
        repositoryIds: [1]
      };

      const result = await store.executeBatchOperation(operation);

      expect(result).toEqual(mockResult);
      expect(store.selectedIds().size).toBe(0); // 選択がクリアされる
      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        [mockRepository1],
        operation,
        2
      );
    });

    it('リポジトリが選択されていない場合にエラーを投げること', async () => {
      const operation: RepositoryOperation = {
        type: 'archive',
        repositoryIds: []
      };

      await expectAsync(store.executeBatchOperation(operation)).toBeRejectedWithError('No repositories selected');
    });

    it('バッチ操作の失敗を適切に処理すること', async () => {
      const error = new Error('Batch operation failed');
      mockGitHubService.batchOperation.and.returnValue(throwError(() => error));
      
      store.selectRepository(1);
      const operation: RepositoryOperation = {
        type: 'archive',
        repositoryIds: [1]
      };

      await expectAsync(store.executeBatchOperation(operation)).toBeRejectedWithError('Batch operation failed');
    });

    it('削除操作時にローカル状態が更新されること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepository(1);

      const operation: RepositoryOperation = {
        type: 'delete',
        repositoryIds: [1]
      };

      await store.executeBatchOperation(operation);

      // リポジトリがローカル状態から削除される
      const repos = store.repositories();
      expect(repos.find(r => r.id === 1)).toBeUndefined();
      expect(repos.length).toBe(2);
    });

    it('非削除操作時にリポジトリがリフレッシュされること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepository(1);

      const operation: RepositoryOperation = {
        type: 'archive',
        repositoryIds: [1]
      };

      const loadSpy = spyOn(store, 'loadRepositories').and.returnValue(Promise.resolve());
      await store.executeBatchOperation(operation);

      expect(loadSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('個別操作メソッドのテスト', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('単一リポジトリをアーカイブできること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepository(1); // リポジトリを選択

      await store.archiveRepository(1);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        jasmine.arrayContaining([jasmine.objectContaining({ id: 1 })]),
        { type: 'archive', repositoryIds: [1] },
        2
      );
    });

    it('単一リポジトリのアーカイブを解除できること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepository(1); // リポジトリを選択

      await store.unarchiveRepository(1);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        jasmine.arrayContaining([jasmine.objectContaining({ id: 1 })]),
        { type: 'unarchive', repositoryIds: [1] },
        2
      );
    });

    it('単一リポジトリを削除できること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepository(1); // リポジトリを選択

      await store.deleteRepository(1);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        jasmine.arrayContaining([jasmine.objectContaining({ id: 1 })]),
        { type: 'delete', repositoryIds: [1] },
        2
      );
    });

    it('操作が失敗した場合にエラーを投げること', async () => {
      const mockResult: BatchOperationResult = {
        success: [],
        errors: [{ repository: mockRepository1, error: 'Operation failed' }],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepository(1); // リポジトリを選択

      await expectAsync(store.deleteRepository(1)).toBeRejectedWithError('Operation failed');
    });
  });

  describe('バッチ操作メソッドのテスト', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('複数リポジトリをバッチアーカイブできること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1, mockRepository2],
        errors: [],
        total: 2,
        completed: 2,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepositories([1, 2]); // リポジトリを選択

      await store.batchArchive([1, 2]);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        jasmine.arrayContaining([
          jasmine.objectContaining({ id: 1 }),
          jasmine.objectContaining({ id: 2 })
        ]),
        { type: 'archive', repositoryIds: [1, 2] },
        2
      );
    });

    it('複数リポジトリをバッチアーカイブ解除できること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1, mockRepository2],
        errors: [],
        total: 2,
        completed: 2,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepositories([1, 2]); // リポジトリを選択

      await store.batchUnarchive([1, 2]);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        jasmine.arrayContaining([
          jasmine.objectContaining({ id: 1 }),
          jasmine.objectContaining({ id: 2 })
        ]),
        { type: 'unarchive', repositoryIds: [1, 2] },
        2
      );
    });

    it('複数リポジトリをバッチ削除できること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1, mockRepository2],
        errors: [],
        total: 2,
        completed: 2,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepositories([1, 2]); // リポジトリを選択

      await store.batchDelete([1, 2]);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        jasmine.arrayContaining([
          jasmine.objectContaining({ id: 1 }),
          jasmine.objectContaining({ id: 2 })
        ]),
        { type: 'delete', repositoryIds: [1, 2] },
        2
      );
    });

    it('バッチ操作でエラーがある場合に適切なエラーメッセージを投げること', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [{ repository: mockRepository2, error: 'Failed to archive' }],
        total: 2,
        completed: 2,
        remaining: 0
      };

      mockGitHubService.batchOperation.and.returnValue(of(mockResult));
      store.selectRepositories([1, 2]); // リポジトリを選択

      await expectAsync(store.batchArchive([1, 2])).toBeRejectedWithError('1 repositories failed to archive');
    });
  });

  describe('レート制限情報の取得テスト', () => {
    it('GitHubサービスからレート制限情報を取得できること', () => {
      const mockRateLimit = {
        limit: 5000,
        remaining: 4999,
        reset: 1640995200,
        used: 1,
        resource: 'core'
      };

      mockGitHubService.getRateLimit.and.returnValue(mockRateLimit);
      
      const rateLimit = store.rateLimit();
      expect(rateLimit).toEqual(mockRateLimit);
    });

    it('レート制限情報がnullの場合を適切に処理すること', () => {
      mockGitHubService.getRateLimit.and.returnValue(null);
      
      const rateLimit = store.rateLimit();
      expect(rateLimit).toBeNull();
    });
  });
});