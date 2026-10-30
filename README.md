# CORE 巴西柔術體驗營報名網站

靜態網站（GitHub Pages）＋ Google Apps Script 線上資料庫與寄信。

## 功能

- 活動介紹與報名費
- 線上報名（日期、身分、繳費方式）
- 修改報名資料
- 電子信箱選填；有填才寄確認／更新通知信
- 報名資料存於 Google 試算表

## 快速啟用

### 1. 部署後端（必做，才能報名與寄信）

依照 [`backend/README.md`](backend/README.md) 將 `backend/Code.gs` 部署為 Google Apps Script 網頁應用程式，並把 `/exec` 網址填入 `js/config.js`。

### 2. 放到 GitHub 並開啟 Pages

1. 建立 GitHub repository（例如 `core-bjj`）
2. 推上 `main` 分支
3. **Settings → Pages → Build and deployment**
   - Source：`Deploy from a branch`
   - Branch：`main` / `/ (root)`
4. 稍待後網站網址為：

`https://<你的帳號>.github.io/<repo名稱>/`

## 本機預覽

用瀏覽器直接開啟 `index.html`，或在專案目錄執行：

```bash
npx --yes serve .
```
