# Repo Cleaner Angular について

この「Repo Cleaner Angular」は、**GitHub リポジトリを一括でアーカイブ・削除できる無料の SPA（シングルページアプリ）** です。
個人の PAT（Personal Access Token）を貼り付けるだけで、不要なリポジトリを効率的に整理できます。
日本語・英語・繁体字中国語に対応しています。

## 🚀 オンラインで試す

**ライブデモ：** [https://tetsufromtw.github.io/repo-cleaner-angular/](https://tetsufromtw.github.io/repo-cleaner-angular/)

すぐに使いたい方は上のリンクから直接アクセスできます！GitHub Personal Access Token を用意するだけで、すぐにリポジトリの整理を開始できます。

### 主な機能

- PAT 認証による安全なリポジトリ操作（トークンはローカルのみで使用）
- リポジトリ一覧の高速表示・フィルタ・並び替え・多選択
- 一括アーカイブ・削除・復元
- 危険操作時の二重確認ダイアログ
- バッチ処理の進捗表示と CSV エクスポート
- アクセシビリティ・キーボード操作対応

---

## インストールと起動方法

### 通常のインストール

1. リポジトリをクローン
   ```bash
   git clone https://github.com/tetsufromtw/repo-cleaner-angular.git
   cd repo-cleaner-angular
   ```
2. 依存パッケージをインストール
   ```bash
   npm install
   ```
3. 開発サーバーを起動
   ```bash
   npm start
   ```
   または
   ```bash
   ng serve
   ```
4. ブラウザでアクセス
   http://localhost:4200/

### Docker を使った起動方法

#### 開発環境
```bash
# リポジトリをクローン
git clone https://github.com/tetsufromtw/repo-cleaner-angular.git
cd repo-cleaner-angular

# 開発環境で起動
docker-compose --profile dev up --build

# ブラウザでアクセス
# http://localhost:4200/
```

#### 本番環境
```bash
# 本番環境ビルドと起動
docker-compose up --build

# ブラウザでアクセス
# http://localhost/
```

#### Docker を使う利点
- 環境構築が不要（Node.js、npm のインストール不要）
- 一貫した実行環境の提供
- 本番環境と同じ環境でのテストが可能
- Nginx を使った最適化された配信

---

## 使い方

1. トップ画面で「Personal Access Token（PAT）」を貼り付けて認証します。
2. リポジトリ一覧が表示されるので、フィルタや並び替えで不要なリポジトリを選択します。
3. 「アーカイブ」「削除」などの操作を選びます。削除時は二重確認が表示されます。
4. バッチ処理の進捗を確認し、結果を CSV でダウンロードできます。

---

## 注意事項

- PAT はローカルのみで使用され、外部に送信されません。
- GitHub の API レート制限や権限不足の場合は、画面上で案内が表示されます。

---
