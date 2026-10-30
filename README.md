# Wing9897 Tools Hub

**Wing9897 Tools Hub** 是單一前端應用。所有工具都在同一個應用裡，從工作台進入，不再是各自獨立的 HTML 檔。

線上網站：[Wing9897.github.io](https://wing9897.github.io/)

## 本地開發

在專案目錄執行：

```bash
npm install
npm run dev
```

## 正式建置

```bash
npm run build
npm run preview
```

`npm run build` 會把產物寫到倉庫根目錄的 `dist/`。

## 部署

線上網站由 GitHub Actions 從 `dist/` 發布。推送預設分支 `main` 會觸發這個工作流程，也可以在 Actions 頁面手動執行。

此倉庫的 GitHub Pages 來源必須設為 GitHub Actions。

`upload_git.bat` 會提交並推送目前所在分支。人在 `main` 上執行它時，推送就會觸發上述工作流程。

## 離線與 PWA

應用殼可以安裝到裝置上。交易所、IP 情報與鏈上 RPC 呼叫仍需要網路。

## 建議

有任何建議，歡迎提交 [Issue](https://github.com/Wing9897/Wing9897.github.io/issues)，也歡迎 Pull Request。

## 聯絡方式

- GitHub：[Wing9897](https://github.com/Wing9897)
