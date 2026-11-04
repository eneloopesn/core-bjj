# 後端部署（Google Apps Script）

報名資料存在 Google 試算表；有填電子信箱時會寄出通知信。

## 步驟

1. 開啟 [Google 試算表](https://sheets.google.com)，新建空白試算表（可命名 `Jabari-BJJ-Registrations`）。
2. 選單：**擴充功能 → Apps Script**。
3. 貼上本資料夾的 `Code.gs`，儲存。
4. **部署 → 新增部署作業** → 網頁應用程式  
   - 執行身分：我本人  
   - 存取權：任何人
5. 複製 `/exec` 網址到前端 `js/config.js` 的 `API_URL`。

## 更新程式後（必做）

1. 貼上最新 `Code.gs` 並儲存  
2. **部署 → 管理部署作業 → 鉛筆 → 版本選「新版本」→ 部署**  
3. 測試：`你的API網址?action=ping`  
   應看到 `"version":"inhouse-v1"`

## 建議

若舊試算表欄位仍是研習營格式，可新建空白試算表重新綁定，或清空 `registrations` 工作表後重跑一次報名。
