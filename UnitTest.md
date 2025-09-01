# Repo Cleaner Angular プロジェクトのユニットテスト戦略

## 概要

このプロジェクトでは、**Jasmine** テストフレームワークと **Karma** テストランナーを使用してユニットテストを実装します。Angular CLI のデフォルトテスト環境を活用し、コードの品質向上と Findy 偏差値の向上を目指します。

## テスト対象と戦略

### 🎯 主要テスト対象

#### 1. データアクセス層 (`src/app/data-access/`)

**GitHubService**

- GitHub API との通信ロジック
- 認証処理（トークン設定・検証・クリア）
- リポジトリの取得・アーカイブ・削除操作
- エラーハンドリングとレート制限対応
- localStorage を使用したトークンの永続化

**RepositoryStore**

- アプリケーション状態管理
- リポジトリのフィルタリング・ソート機能
- 選択状態の管理（単一選択・範囲選択・全選択）
- バッチ操作の実行とプログレス管理
- Computed signals を使用した派生状態の計算

#### 2. 共通 UI コンポーネント (`src/app/shared/components/ui/`)

**UiButtonComponent**

- 異なる variant（primary/secondary/danger）の表示
- size プロパティによる見た目の変更
- disabled/loading 状態の処理
- クリックイベントの発生確認

### 🧪 テスト手法

#### Pure Unit Testing（純粋単体テスト）

- **対象**: サービス層、ストア層、ユーティリティ関数
- **特徴**: 外部依存関係を完全にモック化
- **目的**: ビジネスロジックの正確性を検証

**例：GitHubService のテスト**

```typescript
// HTTP通信をモック化してAPIロジックのみテスト
it("should set and store token correctly", () => {
  const mockToken = "ghp_test_token";
  service.setToken(mockToken);

  expect(service.getToken()).toBe(mockToken);
  expect(service.isAuthenticated()).toBe(true);
});
```

#### Component Testing（コンポーネントテスト）

- **対象**: UI コンポーネント
- **特徴**: Angular TestBed を使用した浅いレンダリング
- **目的**: コンポーネントの入出力とイベント処理を検証

**例：UiButtonComponent のテスト**

```typescript
// プロパティ変更による見た目の変化をテスト
it("should apply correct CSS classes for variant", () => {
  component.variant = "primary";
  fixture.detectChanges();

  const button = fixture.nativeElement.querySelector("button");
  expect(button).toHaveClass("ui-button--primary");
});
```

### 🛠 テスト環境の設定

#### 使用技術

- **Jasmine**: BDD スタイルのテストフレームワーク
- **Karma**: ブラウザベースのテストランナー
- **Angular Testing Utilities**: TestBed、ComponentFixture
- **HttpClientTestingModule**: HTTP 通信のモック化

#### モック戦略

**localStorage のモック**

```typescript
const mockLocalStorage = {
  getItem: jasmine.createSpy("getItem").and.returnValue(null),
  setItem: jasmine.createSpy("setItem"),
  removeItem: jasmine.createSpy("removeItem"),
};
```

**HTTP 通信のモック**

```typescript
// HttpClientTestingModule を使用
const httpTestingController = TestBed.inject(HttpTestingController);
const req = httpTestingController.expectOne("/api/endpoint");
req.flush(mockResponse);
```

### 📊 カバレッジ目標

#### カバレッジ指標

- **行カバレッジ**: 80% 以上
- **関数カバレッジ**: 85% 以上
- **分岐カバレッジ**: 75% 以上

#### 優先度別テストカバレッジ

**最高優先度**（必須）

- GitHubService: 全メソッドの正常系・異常系
- RepositoryStore: 状態変更と computed signals

**高優先度**（推奨）

- フィルタリング・ソート ロジック
- バッチ操作とエラーハンドリング

**中優先度**（時間があれば）

- UI コンポーネントのプロパティ変更
- イベントハンドラの動作確認

### 🚀 テスト実行と CI 統合

#### ローカル開発

```bash
# 一回だけ実行
npm test -- --watch=false --browsers=ChromeHeadless

# ウォッチモード（開発中）
npm test

# カバレッジ付き実行
npm test -- --code-coverage
```

#### CI/CD パイプライン統合

GitHub Actions で自動テスト実行を設定し、以下を実現：

- Pull Request 作成時の自動テスト
- カバレッジレポートの生成と表示
- テスト失敗時のデプロイ防止

### 📋 テスト実装計画

#### Phase 1: Core Services（Week 1）

1. GitHubService のベーシックテスト
2. 認証関連機能のテスト
3. エラーハンドリングのテスト

#### Phase 2: State Management（Week 2）

1. RepositoryStore の状態管理テスト
2. フィルタリング・ソート機能のテスト
3. 選択機能のテスト

#### Phase 3: Integration & Polish（Week 3）

1. バッチ操作のテスト
2. UI コンポーネントのテスト
3. エッジケースとパフォーマンステスト

### 🎖 期待される効果

#### 開発効率の向上

- バグの早期発見・修正
- リファクタリング時の安全性確保
- 新機能追加時の回帰テスト

#### コード品質の向上

- コードの設計改善
- 依存関係の明確化
- ドキュメントとしてのテストコード

---

## Note: WSL2環境でのカバレッジレポート生成

WSL2環境でヘッドレスブラウザを使ってカバレッジレポートを生成するには、以下のコマンドを使用します：

```bash
CHROME_BIN=$(node -e "console.log(require('puppeteer').executablePath())") \
ng test --watch=false --browsers=ChromeHeadless --code-coverage
```

このコマンドにより、`coverage/` フォルダにHTMLレポートが生成され、詳細なコードカバレッジを確認できます。
