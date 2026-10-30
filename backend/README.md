# 後端部署（Google Apps Script）

報名資料會存在 Google 試算表，有填電子信箱時會用你的 Gmail 寄出通知信。

## 步驟

1. 開啟 [Google 試算表](https://sheets.google.com)，新建空白試算表（名稱可設為 `CORE-BJJ-Registrations`）。
2. 選單：**擴充功能 → Apps Script**。
3. 刪除預設程式碼，改貼上本資料夾的 `Code.gs` 全部內容，按儲存。
4. 右上角 **部署 → 新增部署作業**：
   - 類型選 **網頁應用程式**
   - 說明：`CORE BJJ API`
   - 執行身分：**我本人**
   - 具有存取權的使用者：**任何人**
5. 授權後，複製 **網頁應用程式網址**（結尾為 `/exec`）。
6. 打開專案的 `js/config.js`，把網址貼到 `API_URL`：

```js
window.BJJ_CONFIG = {
  API_URL: "https://script.google.com/macros/s/你的部署ID/exec",
};
```

7. 把更新後的網站推上 GitHub（或重新上傳 `config.js`）。

## 更新程式後（很重要）

只按儲存不會更新線上 API。請：

1. 貼上最新 `Code.gs` 並儲存
2. **部署 → 管理部署作業**
3. 點鉛筆圖示 → **版本** 選 **新版本** → **部署**

完成後可用下面測試確認版本：

`你的API網址?action=ping`

應看到 `"version":"name-lookup-v2"`。
