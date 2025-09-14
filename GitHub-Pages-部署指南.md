# GitHub Pages 部署指南

## 📖 什麼是 GitHub Pages？

GitHub Pages 是 GitHub 提供的免費靜態網站托管服務，可以直接從你的 GitHub 儲存庫部署網站。對於 Angular 這類前端專案來說，是一個完美的免費部署選擇。

## 🎯 部署方式選擇

我們推薦使用 **GitHub Actions 自動部署**，這是最現代化且省事的方式。

## 🚀 自動部署設定（推薦）

### 步驟 1：建立 GitHub Actions 工作流程

在專案根目錄建立 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]

# 設定 GITHUB_TOKEN 權限
permissions:
  contents: read
  pages: write
  id-token: write

# 只允許一個部署同時進行
concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build for production
      run: npm run build -- --base-href="/repo-cleaner-angular/"
    
    - name: Setup Pages
      uses: actions/configure-pages@v3
    
    - name: Upload artifact
      uses: actions/upload-pages-artifact@v2
      with:
        path: './dist/repo-cleaner-angular'
    
    - name: Deploy to GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v2
```

### 步驟 2：啟用 GitHub Pages

1. 前往你的 GitHub 儲存庫
2. 點選 **Settings** 頁籤
3. 左側選單找到 **Pages**
4. 在 **Source** 選擇 **GitHub Actions**
5. 儲存設定

### 步驟 3：推送並部署

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: 新增GitHub Pages自動部署工作流程"
git push origin master
```

推送後，GitHub Actions 會自動開始建置和部署流程。

## 🔧 手動部署方式

如果你偏好手動控制部署過程：

### 步驟 1：安裝部署工具

```bash
npm install --save-dev angular-cli-ghpages
```

### 步驟 2：建置專案

```bash
npm run build -- --base-href="/repo-cleaner-angular/"
```

### 步驟 3：部署

```bash
npx angular-cli-ghpages --dir=dist/repo-cleaner-angular
```

## 🎯 重要設定說明

### Base Href 設定

GitHub Pages 會將你的網站部署到 `https://username.github.io/repo-name/`，所以需要設定正確的 base href：

```bash
--base-href="/repo-cleaner-angular/"
```

### Angular.json 修改（可選）

你也可以在 `angular.json` 中預設設定：

```json
{
  "projects": {
    "repo-cleaner-angular": {
      "architect": {
        "build": {
          "options": {
            "baseHref": "/repo-cleaner-angular/"
          }
        }
      }
    }
  }
}
```

## 🔍 部署後檢查

### 確認部署狀態

1. 前往 GitHub 儲存庫的 **Actions** 頁籤
2. 查看工作流程是否成功執行
3. 在 **Settings > Pages** 查看部署狀態

### 訪問網站

部署成功後，你的網站會在以下網址可用：
```
https://你的GitHub用戶名.github.io/repo-cleaner-angular/
```

## ❗ 常見問題與解決方案

### 問題 1：網站顯示 404

**原因：** Base href 設定錯誤

**解決方案：**
```bash
npm run build -- --base-href="/你的儲存庫名稱/"
```

### 問題 2：CSS/JS 檔案載入失敗

**原因：** 路徑問題，通常也是 base href 相關

**解決方案：** 確保 base href 正確設定，並且以 `/` 結尾

### 問題 3：Angular 路由在重新整理時 404

**原因：** GitHub Pages 不支援 SPA 路由

**解決方案：** 在 `src` 資料夾建立 `404.html`，內容與 `index.html` 相同：

```bash
cp src/index.html src/404.html
```

### 問題 4：GitHub Actions 部署失敗

**常見原因：**
- 權限不足：檢查 **Settings > Actions > General** 中的權限設定
- Node 版本不符：確保 GitHub Actions 使用的 Node 版本與專案相容

## 🎉 部署成功後的好處

1. **免費托管** - GitHub Pages 完全免費
2. **自動更新** - 每次推送 master 分支都會自動部署最新版本
3. **HTTPS 支援** - 自動提供 SSL 證書
4. **CDN 加速** - GitHub 的全球 CDN 提供快速存取

## 💡 進階提示

### 自定義網域

如果你有自己的網域，可以在儲存庫根目錄建立 `CNAME` 檔案：

```
your-custom-domain.com
```

### 多環境部署

可以設定不同分支部署到不同環境：
- `master` 分支 → 正式環境
- `develop` 分支 → 測試環境

## 📝 部署檢查清單

- [ ] 建立 GitHub Actions 工作流程
- [ ] 設定正確的 base href
- [ ] 啟用 GitHub Pages 設定
- [ ] 推送程式碼並確認部署成功
- [ ] 測試網站功能是否正常
- [ ] 確認所有路由都能正常運作

## 🚨 安全注意事項

GitHub Pages 部署的是靜態檔案，所有程式碼都會暴露在用戶端。確保：

1. **不要在程式碼中硬編碼任何敏感資訊**
2. **API 金鑰和密碼絕對不能提交到儲存庫**
3. **這個專案使用使用者自己的 GitHub PAT，所以是安全的**

---

**🎊 恭喜！完成這些步驟後，你的 GitHub Repository Cleaner 就可以在網路上使用了！**