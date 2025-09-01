import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { GitHubService } from './github.service';
import { GitHubRepository, GitHubUser, RateLimit, ListRepositoriesOptions } from './github-types';

describe('GitHubService', () => {
  let service: GitHubService;
  let httpMock: HttpTestingController;
  let mockLocalStorage: jasmine.SpyObj<Storage>;

  // モックデータの定義
  const mockUser: GitHubUser = {
    id: 1,
    login: 'testuser',
    avatar_url: 'https://example.com/avatar.jpg',
    html_url: 'https://github.com/testuser',
    type: 'User',
    name: 'Test User',
    email: 'test@example.com',
    public_repos: 5,
    followers: 10,
    following: 15,
    created_at: '2023-01-01T10:00:00Z'
  };

  const mockRepository: GitHubRepository = {
    id: 123,
    node_id: 'MDEwOlJlcG9zaXRvcnkxMjM=',
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    html_url: 'https://github.com/testuser/test-repo',
    clone_url: 'https://github.com/testuser/test-repo.git',
    ssh_url: 'git@github.com:testuser/test-repo.git',
    description: 'テスト用リポジトリ',
    private: false,
    fork: false,
    archived: false,
    disabled: false,
    language: 'TypeScript',
    stargazers_count: 10,
    watchers_count: 5,
    forks_count: 2,
    open_issues_count: 3,
    size: 1024,
    topics: ['angular', 'typescript'],
    pushed_at: '2023-12-01T10:00:00Z',
    created_at: '2023-01-01T10:00:00Z',
    updated_at: '2023-12-01T10:00:00Z',
    owner: {
      id: 1,
      login: 'testuser',
      avatar_url: 'https://example.com/avatar.jpg',
      html_url: 'https://github.com/testuser',
      type: 'User'
    },
    permissions: {
      admin: true,
      maintain: false,
      push: true,
      triage: false,
      pull: true
    }
  };

  beforeEach(() => {
    // localStorage のモックを作成
    mockLocalStorage = {
      getItem: jasmine.createSpy('getItem').and.returnValue(null),
      setItem: jasmine.createSpy('setItem'),
      removeItem: jasmine.createSpy('removeItem'),
      clear: jasmine.createSpy('clear'),
      key: jasmine.createSpy('key'),
      length: 0
    };

    // window.localStorage をモックで置き換え
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GitHubService]
    });

    service = TestBed.inject(GitHubService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // 未処理のリクエストがないことを確認
    httpMock.verify();
  });

  describe('サービス初期化のテスト', () => {
    it('サービスが正常に作成されること', () => {
      expect(service).toBeTruthy();
    });

    it('初期状態で認証されていないこと', () => {
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.getToken()).toBe('');
      expect(service.getRateLimit()).toBeNull();
    });

    it('localStorage からトークンが復元されること', () => {
      const storedToken = 'stored_test_token';
      mockLocalStorage.getItem.and.returnValue(storedToken);

      // 新しいTestBedを作成して新しいサービスインスタンスを作成
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [GitHubService]
      });

      // window.localStorage をモックで置き換え
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      });

      const newService = TestBed.inject(GitHubService);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('github_repo_cleaner_token');
      expect(newService.getToken()).toBe(storedToken);
      expect(newService.isAuthenticated()).toBeTrue();
    });

    it('localStorage からのトークン読み込みエラーを処理すること', () => {
      mockLocalStorage.getItem.and.throwError('Storage error');
      
      // エラーが発生してもサービスは正常に動作する
      expect(() => TestBed.inject(GitHubService)).not.toThrow();
    });
  });

  describe('認証機能のテスト', () => {
    it('トークンが正しく設定されること', () => {
      const token = 'ghp_test_token_123';
      
      service.setToken(token);
      
      expect(service.getToken()).toBe(token);
      expect(service.isAuthenticated()).toBeTrue();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('github_repo_cleaner_token', token);
    });

    it('トークンが正しくクリアされること', () => {
      service.setToken('test_token');
      service.clearToken();
      
      expect(service.getToken()).toBe('');
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.getRateLimit()).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('github_repo_cleaner_token');
    });

    it('localStorage への書き込みエラーを適切に処理すること', () => {
      mockLocalStorage.setItem.and.throwError('Storage full');
      
      // エラーが発生してもトークンは設定される
      expect(() => service.setToken('test_token')).not.toThrow();
      expect(service.getToken()).toBe('test_token');
    });

    it('トークンの検証が成功すること', () => {
      service.setToken('valid_token');

      service.validateToken().subscribe(result => {
        expect(result).toBeTrue();
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer valid_token');
      expect(req.request.headers.get('Accept')).toBe('application/vnd.github.v3+json');
      expect(req.request.headers.get('X-GitHub-Api-Version')).toBe('2022-11-28');

      req.flush(mockUser);
    });

    it('無効なトークンの検証が失敗すること', () => {
      service.setToken('invalid_token');

      service.validateToken().subscribe(result => {
        expect(result).toBeFalse();
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      req.flush({ message: 'Bad credentials' }, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('API リクエスト機能のテスト', () => {
    beforeEach(() => {
      service.setToken('test_token');
    });

    it('現在のユーザー情報を取得できること', () => {
      service.getCurrentUser().subscribe(user => {
        expect(user).toEqual(mockUser);
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);
    });

    it('デフォルトオプションでリポジトリ一覧を取得できること', () => {
      const mockRepos = [mockRepository];

      service.listRepositories().subscribe(repos => {
        expect(repos).toEqual(mockRepos);
        expect(repos[0].watchers_count).toBe(5);
        expect(repos[0].stargazers_count).toBe(10);
        expect(repos[0].topics).toEqual(['angular', 'typescript']);
      });

      const req = httpMock.expectOne('https://api.github.com/user/repos?');
      expect(req.request.method).toBe('GET');
      req.flush(mockRepos);
    });

    it('カスタムオプションでリポジトリ一覧を取得できること', () => {
      const options: ListRepositoriesOptions = {
        type: 'owner',
        sort: 'updated',
        direction: 'desc',
        per_page: 50,
        page: 2
      };

      service.listRepositories(options).subscribe();

      const expectedUrl = 'https://api.github.com/user/repos?type=owner&sort=updated&direction=desc&per_page=50&page=2';
      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('リポジトリをアーカイブできること', () => {
      const owner = 'testuser';
      const repo = 'test-repo';

      service.archiveRepository(owner, repo).subscribe(result => {
        expect(result.archived).toBeTrue();
      });

      const req = httpMock.expectOne(`https://api.github.com/repos/${owner}/${repo}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ archived: true });
      req.flush({ ...mockRepository, archived: true });
    });

    it('リポジトリのアーカイブを解除できること', () => {
      const owner = 'testuser';
      const repo = 'test-repo';

      service.unarchiveRepository(owner, repo).subscribe(result => {
        expect(result.archived).toBeFalse();
      });

      const req = httpMock.expectOne(`https://api.github.com/repos/${owner}/${repo}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ archived: false });
      req.flush({ ...mockRepository, archived: false });
    });

    it('リポジトリを削除できること', () => {
      const owner = 'testuser';
      const repo = 'test-repo';

      service.deleteRepository(owner, repo).subscribe(result => {
        expect(result).toBeNull();
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

    it('401 Unauthorized エラーを適切に処理すること', () => {
      service.getCurrentUser().subscribe({
        next: () => fail('成功するべきではない'),
        error: (error) => {
          expect(error.message).toBe('Invalid or expired GitHub token');
          expect(error.status).toBe(401);
        }
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      req.flush({ message: 'Bad credentials' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('403 Rate Limit エラーを適切に処理すること', () => {
      service.getCurrentUser().subscribe({
        next: () => fail('成功するべきではない'),
        error: (error) => {
          expect(error.message).toBe('GitHub API rate limit exceeded. Please wait before trying again.');
          expect(error.status).toBe(403);
        }
      });

      const req = httpMock.expectOne('https://api.github.com/user');
      req.flush({ message: 'rate limit exceeded' }, { status: 403, statusText: 'Forbidden' });
    });

    it('403 Insufficient permissions エラーを適切に処理すること', () => {
      service.deleteRepository('owner', 'repo').subscribe({
        next: () => fail('成功するべきではない'),
        error: (error) => {
          expect(error.message).toBe('Insufficient permissions. Please check your token permissions.');
          expect(error.status).toBe(403);
        }
      });

      const req = httpMock.expectOne('https://api.github.com/repos/owner/repo');
      req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    });

    it('404 Not Found エラーを適切に処理すること', () => {
      service.deleteRepository('notfound', 'repo').subscribe({
        next: () => fail('成功するべきではない'),
        error: (error) => {
          expect(error.message).toBe('Repository not found or you don\'t have access to it');
          expect(error.status).toBe(404);
        }
      });

      const req = httpMock.expectOne('https://api.github.com/repos/notfound/repo');
      req.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    });

    it('422 Unprocessable Entity エラーを適切に処理すること', () => {
      service.archiveRepository('owner', 'repo').subscribe({
        next: () => fail('成功するべきではない'),
        error: (error) => {
          expect(error.message).toBe('Invalid request. Please check your input.');
          expect(error.status).toBe(422);
        }
      });

      const req = httpMock.expectOne('https://api.github.com/repos/owner/repo');
      req.flush({ message: 'Validation Failed' }, { status: 422, statusText: 'Unprocessable Entity' });
    });

    it('トークンなしでAPI呼び出しを行うとエラーになること', () => {
      service.clearToken();

      service.getCurrentUser().subscribe({
        next: () => fail('成功するべきではない'),
        error: (error) => {
          expect(error.message).toBe('GitHub token is required');
        }
      });

      httpMock.expectNone('https://api.github.com/user');
    });
  });

  describe('レート制限情報の管理', () => {
    beforeEach(() => {
      service.setToken('test_token');
    });

    it('レスポンスヘッダーからレート制限情報を更新すること', () => {
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

    it('初期状態でレート制限情報がnullであること', () => {
      expect(service.getRateLimit()).toBeNull();
    });

    it('不完全なヘッダー情報でもエラーにならないこと', () => {
      service.getCurrentUser().subscribe();

      const req = httpMock.expectOne('https://api.github.com/user');
      req.flush(mockUser, {
        headers: {
          'x-ratelimit-limit': '5000'
          // remaining と reset が欠けている
        }
      });

      expect(service.getRateLimit()).toBeNull();
    });
  });

  describe('リポジトリデータの正規化', () => {
    beforeEach(() => {
      service.setToken('test_token');
    });

    it('不完全なリポジトリデータを正規化すること', () => {
      const incompleteRepo = {
        ...mockRepository,
        watchers_count: undefined,
        stargazers_count: undefined,
        forks_count: undefined,
        topics: undefined
      };

      service.listRepositories().subscribe(repos => {
        expect(repos[0].watchers_count).toBe(0);
        expect(repos[0].stargazers_count).toBe(0);
        expect(repos[0].forks_count).toBe(0);
        expect(repos[0].topics).toEqual([]);
      });

      const req = httpMock.expectOne('https://api.github.com/user/repos?');
      req.flush([incompleteRepo]);
    });

    it('古い形式のプロパティ名を新しい形式に変換すること', () => {
      const oldFormatRepo = {
        ...mockRepository,
        watchers: 10,
        stargazers: 15,
        forks: 3,
        watchers_count: undefined,
        stargazers_count: undefined,
        forks_count: undefined
      };

      service.listRepositories().subscribe(repos => {
        expect(repos[0].watchers_count).toBe(10);
        expect(repos[0].stargazers_count).toBe(15);
        expect(repos[0].forks_count).toBe(3);
      });

      const req = httpMock.expectOne('https://api.github.com/user/repos?');
      req.flush([oldFormatRepo]);
    });
  });

  describe('クエリパラメータの構築', () => {
    beforeEach(() => {
      service.setToken('test_token');
    });

    it('すべてのオプションが正しくクエリ文字列に変換されること', () => {
      const options: ListRepositoriesOptions = {
        type: 'owner',
        sort: 'created',
        direction: 'asc',
        per_page: 25,
        page: 2,
        since: '2023-01-01T00:00:00Z',
        before: '2023-12-31T23:59:59Z'
      };

      service.listRepositories(options).subscribe();

      const expectedParams = [
        'type=owner',
        'sort=created',
        'direction=asc',
        'per_page=25',
        'page=2',
        'since=2023-01-01T00%3A00%3A00Z',
        'before=2023-12-31T23%3A59%3A59Z'
      ].join('&');

      const req = httpMock.expectOne(`https://api.github.com/user/repos?${expectedParams}`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('undefined のオプションはクエリ文字列に含まれないこと', () => {
      const options: ListRepositoriesOptions = {
        type: 'owner',
        sort: undefined,
        direction: undefined
      };

      service.listRepositories(options).subscribe();

      const req = httpMock.expectOne('https://api.github.com/user/repos?type=owner');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });
});