// GitHub API Types - Repository Management
// GitHub REST API v3 のレスポンス型定義

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Organization';
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  size: number; // KB単位
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  language?: string;
  topics: string[];
  
  // 状態
  private: boolean;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  
  // 日時
  created_at: string;
  updated_at: string;
  pushed_at: string;
  
  // オーナー情報
  owner: {
    id: number;
    login: string;
    avatar_url: string;
    html_url: string;
    type: 'User' | 'Organization';
  };
  
  // パーミッション
  permissions?: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
}

// API レスポンス型
export interface GitHubListResponse<T> {
  data: T[];
  headers: {
    'x-ratelimit-limit'?: string;
    'x-ratelimit-remaining'?: string;
    'x-ratelimit-reset'?: string;
    'x-ratelimit-used'?: string;
    'x-ratelimit-resource'?: string;
    link?: string; // ページネーション用
  };
}

// エラー型
export interface GitHubError {
  message: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
  }>;
  documentation_url?: string;
}

export interface GitHubApiError extends Error {
  status: number;
  response?: {
    data: GitHubError;
    status: number;
    headers: Record<string, string>;
  };
}

// レート制限情報
export interface RateLimit {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
  resource: string;
}

// API リクエストオプション
export interface GitHubApiOptions {
  token: string;
  baseURL?: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

// リポジトリ取得オプション
export interface ListRepositoriesOptions {
  type?: 'owner' | 'public' | 'private' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  since?: string; // ISO 8601 format
  before?: string; // ISO 8601 format
}

// バッチ操作結果
export interface BatchOperationResult {
  success: GitHubRepository[];
  failed: Array<{
    repository: GitHubRepository;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
}

// 操作タイプ
export type RepositoryOperation = 'archive' | 'unarchive' | 'delete';

// フィルター条件
export interface RepositoryFilters {
  // 基本フィルター
  name?: string;
  language?: string;
  starred?: boolean;
  forked?: boolean;
  archived?: boolean;
  private?: boolean;
  
  // 数値フィルター
  minStars?: number;
  maxStars?: number;
  minSize?: number; // KB
  maxSize?: number; // KB
  minForks?: number;
  maxForks?: number;
  
  // 日付フィルター
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  pushedAfter?: Date;
  pushedBefore?: Date;
  
  // トピック
  topics?: string[];
  hasTopics?: boolean;
  
  // 状態
  hasIssues?: boolean;
  hasWiki?: boolean;
  hasPages?: boolean;
  hasDownloads?: boolean;
}

// ソート設定
export interface RepositorySortConfig {
  field: 'name' | 'created_at' | 'updated_at' | 'pushed_at' | 'stargazers_count' | 'forks_count' | 'size';
  direction: 'asc' | 'desc';
}

// アプリケーション状態管理用
export interface RepositoryState {
  repositories: GitHubRepository[];
  filteredRepositories: GitHubRepository[];
  selectedRepositories: Set<number>;
  filters: RepositoryFilters;
  sort: RepositorySortConfig;
  loading: boolean;
  error: string | null;
  rateLimit: RateLimit | null;
  lastFetch: Date | null;
}