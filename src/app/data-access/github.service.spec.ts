import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { GitHubService } from './github.service';
import { GitHubRepository, GitHubUser, RateLimit, ListRepositoriesOptions } from './github-types';

describe('GitHubService', () => {
  let service: GitHubService;
  let httpMock: HttpTestingController;
  
  // Mock data
  const mockUser: GitHubUser = {
    id: 1,
    login: 'testuser',
    avatar_url: 'https://example.com/avatar.jpg',
    html_url: 'https://github.com/testuser',
    name: 'Test User',
    email: 'test@example.com',
    public_repos: 5,
    followers: 10,
    following: 15
  };
  
  const mockRepository: GitHubRepository = {
    id: 123,
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    html_url: 'https://github.com/testuser/test-repo',
    description: 'A test repository',
    private: false,
    fork: false,
    archived: false,
    disabled: false,
    language: 'TypeScript',
    stargazers_count: 10,
    watchers_count: 5,
    forks_count: 2,
    size: 1024,
    default_branch: 'main',
    topics: ['angular', 'typescript'],
    pushed_at: '2023-12-01T10:00:00Z',
    created_at: '2023-01-01T10:00:00Z',
    updated_at: '2023-12-01T10:00:00Z',
    owner: {
      id: 1,
      login: 'testuser',
      avatar_url: 'https://example.com/avatar.jpg',
      html_url: 'https://github.com/testuser'
    },
    permissions: {
      admin: true,
      push: true,
      pull: true
    }
  };

  beforeEach(() => {
    // localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: {
        store: {} as Record<string, string>,
        getItem: jest.fn((key: string) => window.localStorage.store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          window.localStorage.store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete window.localStorage.store[key];
        }),
        clear: jest.fn(() => {
          window.localStorage.store = {};
        })
      },
      writable: true
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GitHubService]
    });

    service = TestBed.inject(GitHubService);
    httpMock = TestBed.inject(HttpTestingController);
    
    // Clear localStorage before each test
    window.localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('認証関連のテスト', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should set and get token correctly', () => {
      const token = 'ghp_test_token';
      service.setToken(token);
      
      expect(service.getToken()).toBe(token);
      expect(service.isAuthenticated()).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('github_repo_cleaner_token', token);
    });

    it('should clear token correctly', () => {
      service.setToken('test_token');
      service.clearToken();
      
      expect(service.getToken()).toBe('');
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalledWith('github_repo_cleaner_token');
    });

    it('should load token from localStorage on initialization', () => {
      const token = 'stored_token';
      (localStorage.getItem as jest.Mock).mockReturnValue(token);
      
      // 新しいサービスインスタンスを作成
      const newService = new GitHubService();
      
      expect(newService.getToken()).toBe(token);
      expect(newService.isAuthenticated()).toBe(true);
    });

    it('should validate token successfully', () => {
      service.setToken('valid_token');
      
      service.validateToken().subscribe(result => {
        expect(result).toBe(true);
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer valid_token');
      
      req.flush(mockUser);
    });

    it('should handle invalid token validation', () => {
      service.setToken('invalid_token');
      
      service.validateToken().subscribe(result => {
        expect(result).toBe(false);
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      req.flush({ message: 'Bad credentials' }, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('APIリクエスト関連のテスト', () => {
    beforeEach(() => {
      service.setToken('test_token');
    });

    it('should get current user', () => {
      service.getCurrentUser().subscribe(user => {
        expect(user).toEqual(mockUser);
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test_token');
      expect(req.request.headers.get('Accept')).toBe('application/vnd.github.v3+json');
      
      req.flush(mockUser);
    });

    it('should list repositories with default options', () => {
      const mockRepos = [mockRepository];
      
      service.listRepositories().subscribe(repos => {
        expect(repos).toEqual(mockRepos);
        expect(repos[0].watchers_count).toBe(5);
        expect(repos[0].stargazers_count).toBe(10);
      });

      const req = httpMock.expectOne('https://api.github.com/user/repos?');
      expect(req.request.method).toBe('GET');
      
      req.flush(mockRepos);
    });

    it('should list repositories with custom options', () => {
      const options: ListRepositoriesOptions = {
        type: 'owner',
        sort: 'updated',
        direction: 'desc',
        per_page: 50
      };
      
      service.listRepositories(options).subscribe();

      const req = httpMock.expectOne(
        'https://api.github.com/user/repos?type=owner&sort=updated&direction=desc&per_page=50'
      );
      expect(req.request.method).toBe('GET');
      
      req.flush([]);
    });

    it('should archive repository', () => {
      const owner = 'testuser';
      const repo = 'test-repo';
      
      service.archiveRepository(owner, repo).subscribe(result => {
        expect(result.archived).toBe(true);
      });

      const req = httpMock.expectOne(`https://api.github.com/repos/${owner}/${repo}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ archived: true });
      
      req.flush({ ...mockRepository, archived: true });
    });

    it('should unarchive repository', () => {
      const owner = 'testuser';
      const repo = 'test-repo';
      
      service.unarchiveRepository(owner, repo).subscribe(result => {
        expect(result.archived).toBe(false);
      });

      const req = httpMock.expectOne(`https://api.github.com/repos/${owner}/${repo}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ archived: false });
      
      req.flush({ ...mockRepository, archived: false });
    });

    it('should delete repository', () => {
      const owner = 'testuser';
      const repo = 'test-repo';
      
      service.deleteRepository(owner, repo).subscribe(result => {
        expect(result).toBeUndefined();
      });

      const req = httpMock.expectOne(`https://api.github.com/repos/${owner}/${repo}`);
      expect(req.request.method).toBe('DELETE');
      
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('エラーハンドリングのテスト', () => {
    beforeEach(() => {
      service.setToken('test_token');
    });

    it('should handle 401 Unauthorized error', () => {
      service.getCurrentUser().subscribe({
        error: (error) => {
          expect(error.message).toBe('Invalid or expired GitHub token');
          expect(error.status).toBe(401);
        }
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      req.flush({ message: 'Bad credentials' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should handle 403 rate limit error', () => {
      service.getCurrentUser().subscribe({
        error: (error) => {
          expect(error.message).toBe('GitHub API rate limit exceeded. Please wait before trying again.');
          expect(error.status).toBe(403);
        }
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      req.flush({ message: 'rate limit exceeded' }, { status: 403, statusText: 'Forbidden' });
    });

    it('should handle 404 Not Found error', () => {
      service.deleteRepository('notfound', 'repo').subscribe({
        error: (error) => {
          expect(error.message).toBe('Repository not found or you don\'t have access to it');
          expect(error.status).toBe(404);
        }
      });

      const req = httpMock.expectOne('https://api.github.com/repos/notfound/repo');
      req.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    });

    it('should require token for API calls', () => {
      service.clearToken();
      
      service.getCurrentUser().subscribe({
        error: (error) => {
          expect(error.message).toBe('GitHub token is required');
        }
      });

      httpMock.expectNone('https://api.github.com/user');
    });
  });

  describe('レート制限情報のテスト', () => {
    beforeEach(() => {
      service.setToken('test_token');
    });

    it('should update rate limit info from response headers', () => {
      service.getCurrentUser().subscribe();

      const req = httpMock.expectOne('https://api.github.com/user');
      req.flush(mockUser, {
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': '1640995200',
          'x-ratelimit-used': '1',
          'x-ratelimit-resource': 'core'
        }
      });

      const rateLimit = service.getRateLimit();
      expect(rateLimit).toEqual({
        limit: 5000,
        remaining: 4999,
        reset: 1640995200,
        used: 1,
        resource: 'core'
      });
    });

    it('should return null for rate limit info initially', () => {
      expect(service.getRateLimit()).toBeNull();
    });
  });

  describe('ユーティリティ機能のテスト', () => {
    it('should normalize repository data', () => {
      service.setToken('test_token');
      
      // watchers と stargazers が欠けているリポジトリデータ
      const incompleteRepo = {
        ...mockRepository,
        watchers_count: undefined,
        stargazers_count: undefined,
        topics: undefined
      };
      
      service.listRepositories().subscribe(repos => {
        expect(repos[0].watchers_count).toBe(0);
        expect(repos[0].stargazers_count).toBe(0);
        expect(repos[0].topics).toEqual([]);
      });

      const req = httpMock.expectOne('https://api.github.com/user/repos?');
      req.flush([incompleteRepo]);
    });

    it('should build repository params correctly', () => {
      service.setToken('test_token');
      
      const options: ListRepositoriesOptions = {
        type: 'all',
        sort: 'created',
        direction: 'asc',
        per_page: 25,
        page: 2
      };
      
      service.listRepositories(options).subscribe();

      const req = httpMock.expectOne(
        'https://api.github.com/user/repos?type=all&sort=created&direction=asc&per_page=25&page=2'
      );
      expect(req.request.method).toBe('GET');
      
      req.flush([]);
    });
  });
});