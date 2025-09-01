import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError, Observable } from 'rxjs';
import { RepositoryStore } from './repository.store';
import { GitHubService } from './github.service';
import { GitHubRepository, RepositoryFilters, RepositoryOperation, BatchOperationResult } from './github-types';

describe('RepositoryStore', () => {
  let store: RepositoryStore;
  let mockGitHubService: jest.Mocked<GitHubService>;

  // Mock data
  const mockRepository1: GitHubRepository = {
    id: 1,
    name: 'repo-a',
    full_name: 'user/repo-a',
    html_url: 'https://github.com/user/repo-a',
    description: 'Repository A',
    private: false,
    fork: false,
    archived: false,
    disabled: false,
    language: 'TypeScript',
    stargazers_count: 10,
    watchers_count: 5,
    forks_count: 2,
    size: 1000,
    default_branch: 'main',
    topics: ['angular', 'typescript'],
    pushed_at: '2023-12-01T10:00:00Z',
    created_at: '2023-01-01T10:00:00Z',
    updated_at: '2023-12-01T10:00:00Z',
    owner: {
      id: 1,
      login: 'user',
      avatar_url: 'https://example.com/avatar.jpg',
      html_url: 'https://github.com/user'
    },
    permissions: {
      admin: true,
      push: true,
      pull: true
    }
  };

  const mockRepository2: GitHubRepository = {
    ...mockRepository1,
    id: 2,
    name: 'repo-b',
    full_name: 'user/repo-b',
    language: 'JavaScript',
    stargazers_count: 5,
    archived: true,
    private: true,
    topics: ['react', 'javascript']
  };

  const mockRepository3: GitHubRepository = {
    ...mockRepository1,
    id: 3,
    name: 'repo-c',
    full_name: 'user/repo-c',
    language: null,
    stargazers_count: 0,
    fork: true,
    topics: []
  };

  beforeEach(() => {
    const gitHubServiceMock = {
      getAllRepositories: jest.fn().mockReturnValue(of([mockRepository1, mockRepository2, mockRepository3])),
      getRateLimit: jest.fn().mockReturnValue(null),
      batchOperation: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        RepositoryStore,
        { provide: GitHubService, useValue: gitHubServiceMock }
      ]
    });

    store = TestBed.inject(RepositoryStore);
    mockGitHubService = TestBed.inject(GitHubService) as jest.Mocked<GitHubService>;
  });

  describe('初期化と基本状態', () => {
    it('should be created with initial state', () => {
      expect(store).toBeTruthy();
      expect(store.repositories()).toEqual([]);
      expect(store.selectedIds().size).toBe(0);
      expect(store.filters()).toEqual({});
      expect(store.sortBy()).toBe('updated_at');
      expect(store.sortDirection()).toBe('desc');
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('should load repositories successfully', async () => {
      await store.loadRepositories();

      expect(store.repositories()).toEqual([mockRepository1, mockRepository2, mockRepository3]);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.lastFetch()).toBeTruthy();
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(1);
    });

    it('should handle repository loading error', async () => {
      const error = new Error('API Error');
      mockGitHubService.getAllRepositories.mockReturnValue(throwError(() => error));

      await store.loadRepositories();

      expect(store.repositories()).toEqual([]);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBe('API Error');
    });

    it('should use cache when not forcing refresh', async () => {
      // First load
      await store.loadRepositories();
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(1);

      // Second load within cache expiry (should not call API)
      await store.loadRepositories();
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(1);

      // Force refresh (should call API)
      await store.loadRepositories(true);
      expect(mockGitHubService.getAllRepositories).toHaveBeenCalledTimes(2);
    });
  });

  describe('フィルター機能', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('should filter by name', () => {
      store.setFilter('name', 'repo-a');
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('repo-a');
    });

    it('should filter by language', () => {
      store.setFilter('language', 'TypeScript');
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].language).toBe('TypeScript');
    });

    it('should filter by starred status', () => {
      store.setFilter('starred', true);
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(2); // repo-a(10 stars) and repo-b(5 stars)
      expect(filtered.every(r => r.stargazers_count > 0)).toBe(true);
    });

    it('should filter by archived status', () => {
      store.setFilter('archived', true);
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].archived).toBe(true);
    });

    it('should filter by private status', () => {
      store.setFilter('private', true);
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].private).toBe(true);
    });

    it('should filter by fork status', () => {
      store.setFilter('forked', true);
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].fork).toBe(true);
    });

    it('should filter by star count range', () => {
      store.updateFilters({ minStars: 5, maxStars: 10 });
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(2); // repo-a(10) and repo-b(5)
      expect(filtered.every(r => r.stargazers_count >= 5 && r.stargazers_count <= 10)).toBe(true);
    });

    it('should filter by topics', () => {
      store.setFilter('topics', ['angular']);
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].topics).toContain('angular');
    });

    it('should filter by hasTopics', () => {
      store.setFilter('hasTopics', false);
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].topics).toHaveLength(0);
    });

    it('should apply multiple filters', () => {
      store.updateFilters({
        language: 'TypeScript',
        starred: true,
        private: false
      });
      
      const filtered = store.filteredRepositories();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('repo-a');
    });

    it('should clear filters', () => {
      store.updateFilters({ language: 'TypeScript', starred: true });
      expect(store.filteredRepositories()).toHaveLength(1);

      store.clearFilters();
      expect(store.filters()).toEqual({});
      expect(store.filteredRepositories()).toHaveLength(3);
    });

    it('should reset filters', () => {
      store.updateFilters({ language: 'TypeScript' });
      store.resetFilters();
      
      expect(store.filters()).toEqual({});
      expect(store.filteredRepositories()).toHaveLength(3);
    });
  });

  describe('ソート機能', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('should sort by name ascending', () => {
      store.setSortBy('name');
      store.setSortDirection('asc');
      
      const sorted = store.filteredRepositories();
      expect(sorted[0].name).toBe('repo-a');
      expect(sorted[1].name).toBe('repo-b');
      expect(sorted[2].name).toBe('repo-c');
    });

    it('should sort by name descending', () => {
      store.setSortBy('name');
      store.setSortDirection('desc');
      
      const sorted = store.filteredRepositories();
      expect(sorted[0].name).toBe('repo-c');
      expect(sorted[1].name).toBe('repo-b');
      expect(sorted[2].name).toBe('repo-a');
    });

    it('should sort by stargazers_count descending', () => {
      store.setSortBy('stargazers_count');
      store.setSortDirection('desc');
      
      const sorted = store.filteredRepositories();
      expect(sorted[0].stargazers_count).toBe(10); // repo-a
      expect(sorted[1].stargazers_count).toBe(5);  // repo-b
      expect(sorted[2].stargazers_count).toBe(0);  // repo-c
    });

    it('should sort by created_at', () => {
      store.setSortBy('created_at');
      store.setSortDirection('desc');
      
      const sorted = store.filteredRepositories();
      expect(sorted.length).toBe(3);
      // All have same created_at in mock data, so order should be maintained
    });
  });

  describe('選択機能', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('should toggle single repository selection', () => {
      expect(store.isSelected(1)).toBe(false);
      
      store.toggleSelection(1);
      expect(store.isSelected(1)).toBe(true);
      expect(store.selectedIds().size).toBe(1);
      
      store.toggleSelection(1);
      expect(store.isSelected(1)).toBe(false);
      expect(store.selectedIds().size).toBe(0);
    });

    it('should select multiple repositories', () => {
      store.selectRepositories([1, 2]);
      
      expect(store.isSelected(1)).toBe(true);
      expect(store.isSelected(2)).toBe(true);
      expect(store.selectedIds().size).toBe(2);
    });

    it('should select individual repository', () => {
      store.selectRepository(1);
      
      expect(store.isSelected(1)).toBe(true);
      expect(store.selectedIds().size).toBe(1);
    });

    it('should deselect individual repository', () => {
      store.selectRepository(1);
      store.deselectRepository(1);
      
      expect(store.isSelected(1)).toBe(false);
      expect(store.selectedIds().size).toBe(0);
    });

    it('should select range of repositories', () => {
      store.selectRange(1, 3);
      
      expect(store.selectedIds().size).toBe(3);
      expect(store.isSelected(1)).toBe(true);
      expect(store.isSelected(2)).toBe(true);
      expect(store.isSelected(3)).toBe(true);
    });

    it('should toggle select all', () => {
      // First toggle - select all
      store.toggleSelectAll();
      expect(store.selectedIds().size).toBe(3);
      
      // Second toggle - deselect all
      store.toggleSelectAll();
      expect(store.selectedIds().size).toBe(0);
    });

    it('should clear selection', () => {
      store.selectRepositories([1, 2, 3]);
      store.clearSelection();
      
      expect(store.selectedIds().size).toBe(0);
    });

    it('should deselect all', () => {
      store.selectRepositories([1, 2, 3]);
      store.deselectAll();
      
      expect(store.selectedIds().size).toBe(0);
    });

    it('should select by condition', () => {
      store.selectByCondition(repo => repo.stargazers_count > 0);
      
      expect(store.selectedIds().size).toBe(2); // repo-a and repo-b have stars
      expect(store.isSelected(1)).toBe(true); // repo-a
      expect(store.isSelected(2)).toBe(true); // repo-b
      expect(store.isSelected(3)).toBe(false); // repo-c has 0 stars
    });

    it('should compute selected repositories correctly', () => {
      store.selectRepositories([1, 2]);
      
      const selected = store.selectedRepositories();
      expect(selected).toHaveLength(2);
      expect(selected.map(r => r.id)).toEqual([1, 2]);
    });

    it('should clear selection when filters change', () => {
      store.selectRepositories([1, 2]);
      expect(store.selectedIds().size).toBe(2);
      
      store.updateFilters({ language: 'TypeScript' });
      expect(store.selectedIds().size).toBe(0);
    });
  });

  describe('選択統計', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('should compute selection statistics', () => {
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

    it('should update statistics when selection changes', () => {
      store.selectRepository(3); // repo-c: fork, 0 stars
      
      const stats = store.selectionStats();
      expect(stats.totalSelected).toBe(1);
      expect(stats.selectedStats.forked).toBe(1);
      expect(stats.selectedStats.totalStars).toBe(0);
    });
  });

  describe('バッチ操作', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('should execute batch operation successfully', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));
      store.selectRepository(1);

      const operation: RepositoryOperation = {
        type: 'archive',
        repositoryIds: [1]
      };

      const result = await store.executeBatchOperation(operation);

      expect(result).toEqual(mockResult);
      expect(store.selectedIds().size).toBe(0); // Selection should be cleared
      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        [mockRepository1],
        operation,
        2
      );
    });

    it('should throw error when no repositories selected', async () => {
      const operation: RepositoryOperation = {
        type: 'archive',
        repositoryIds: []
      };

      await expect(store.executeBatchOperation(operation)).rejects.toThrow('No repositories selected');
    });

    it('should handle batch operation errors', async () => {
      const error = new Error('Batch operation failed');
      mockGitHubService.batchOperation.mockReturnValue(throwError(() => error));
      
      store.selectRepository(1);
      const operation: RepositoryOperation = {
        type: 'archive',
        repositoryIds: [1]
      };

      await expect(store.executeBatchOperation(operation)).rejects.toThrow('Batch operation failed');
    });

    it('should handle delete operation by updating local state', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));
      store.selectRepository(1);

      const operation: RepositoryOperation = {
        type: 'delete',
        repositoryIds: [1]
      };

      await store.executeBatchOperation(operation);

      // Repository should be removed from local state
      const repos = store.repositories();
      expect(repos.find(r => r.id === 1)).toBeUndefined();
      expect(repos).toHaveLength(2);
    });

    it('should refresh repositories for non-delete operations', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));
      store.selectRepository(1);

      const operation: RepositoryOperation = {
        type: 'archive',
        repositoryIds: [1]
      };

      const loadSpy = jest.spyOn(store, 'loadRepositories');
      await store.executeBatchOperation(operation);

      expect(loadSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('個別操作メソッド', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('should archive single repository', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));

      await store.archiveRepository(1);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 1 })]),
        { type: 'archive', repositoryIds: [1] },
        2
      );
    });

    it('should unarchive single repository', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));

      await store.unarchiveRepository(1);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 1 })]),
        { type: 'unarchive', repositoryIds: [1] },
        2
      );
    });

    it('should delete single repository', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));

      await store.deleteRepository(1);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 1 })]),
        { type: 'delete', repositoryIds: [1] },
        2
      );
    });

    it('should throw error when operation fails', async () => {
      const mockResult: BatchOperationResult = {
        success: [],
        errors: [{ repository: mockRepository1, error: 'Operation failed' }],
        total: 1,
        completed: 1,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));

      await expect(store.deleteRepository(1)).rejects.toThrow('Operation failed');
    });
  });

  describe('バッチ操作メソッド', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('should batch archive repositories', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1, mockRepository2],
        errors: [],
        total: 2,
        completed: 2,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));

      await store.batchArchive([1, 2]);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 })
        ]),
        { type: 'archive', repositoryIds: [1, 2] },
        2
      );
    });

    it('should batch unarchive repositories', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1, mockRepository2],
        errors: [],
        total: 2,
        completed: 2,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));

      await store.batchUnarchive([1, 2]);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 })
        ]),
        { type: 'unarchive', repositoryIds: [1, 2] },
        2
      );
    });

    it('should batch delete repositories', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1, mockRepository2],
        errors: [],
        total: 2,
        completed: 2,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));

      await store.batchDelete([1, 2]);

      expect(mockGitHubService.batchOperation).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 })
        ]),
        { type: 'delete', repositoryIds: [1, 2] },
        2
      );
    });

    it('should throw error when batch operations have failures', async () => {
      const mockResult: BatchOperationResult = {
        success: [mockRepository1],
        errors: [{ repository: mockRepository2, error: 'Failed to archive' }],
        total: 2,
        completed: 2,
        remaining: 0
      };

      mockGitHubService.batchOperation.mockReturnValue(of(mockResult));

      await expect(store.batchArchive([1, 2])).rejects.toThrow('1 repositories failed to archive');
    });
  });

  describe('ユーティリティ機能', () => {
    beforeEach(async () => {
      await store.loadRepositories();
    });

    it('should clear error', () => {
      // Set an error first
      store['_error'].set('Test error');
      expect(store.error()).toBe('Test error');

      store.clearError();
      expect(store.error()).toBeNull();
    });

    it('should refresh repositories manually', async () => {
      const loadSpy = jest.spyOn(store, 'loadRepositories');
      
      await store.refreshRepositories();
      
      expect(loadSpy).toHaveBeenCalledWith(true);
    });

    it('should get rate limit info from GitHub service', () => {
      const mockRateLimit = {
        limit: 5000,
        remaining: 4999,
        reset: 1640995200,
        used: 1,
        resource: 'core'
      };

      mockGitHubService.getRateLimit.mockReturnValue(mockRateLimit);
      
      const rateLimit = store.rateLimit();
      expect(rateLimit).toEqual(mockRateLimit);
    });
  });
});