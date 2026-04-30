# Evernote Web Rich Copy

[English README](README.en.md)

Evernote Web Rich Copy 是一個 Chrome / Edge 擴充功能，可以把 Evernote Web 中選取的筆記內容複製成 Rich HTML，方便貼到 Word、Outlook、Excel、Google Docs 或其他支援富文字的編輯器，並盡量保留格式與圖片。

如果你使用的是 Evernote Desktop，請參考 [Evernote Desktop Rich Copy](https://github.com/taoyutsun/Evernote-Desktop-Rich-Copy)。

## 功能

- 將 Evernote Web 目前選取的內容複製為 `text/html` 與 `text/plain`。
- 可在未選取文字時，改用 Copy Active Note 複製目前筆記正文。
- 嘗試將筆記圖片轉成 `data:` URL，讓 Word / Outlook 貼上時不需要再讀取 Evernote 登入狀態。
- 清理 Evernote 頁面 UI，例如 script、隱藏元素、側邊欄、工具列、iframe 與事件屬性。
- 提供擴充功能 popup 按鈕與快捷鍵。
- popup 底部提供作者與 GitHub 專案連結。
- 所有處理都在瀏覽器本機執行，不會把筆記內容傳送到外部伺服器。

## 安裝

1. 前往 [GitHub Releases](https://github.com/taoyutsun/Evernote-Web-Rich-Copy/releases/latest)。
2. 下載最新版 ZIP 檔，例如 `Evernote-Web-Rich-Copy-v0.1.1.zip`。
3. 將 ZIP 解壓縮到一個固定資料夾。之後如果移動或刪除這個資料夾，瀏覽器中的 unpacked extension 也會失效。
4. 開啟 Chrome 或 Edge。
5. 前往 `chrome://extensions` 或 `edge://extensions`。
6. 開啟 Developer mode。
7. 點選 Load unpacked。
8. 選擇解壓縮後、包含 `manifest.json` 的資料夾。
9. 開啟 Evernote Web 並登入。
10. 開啟一則筆記，選取要複製的內容。
11. 點擊擴充功能圖示，選擇 Copy Selection。
12. 到 Word、Outlook、Excel 或其他編輯器貼上。

也可以用 Git 取得原始碼：

```bash
git clone https://github.com/taoyutsun/Evernote-Web-Rich-Copy.git
```

使用 Git 方式時，Load unpacked 請選擇 clone 後包含 `manifest.json` 的專案資料夾。

擴充功能 popup 底部有作者與 GitHub 專案連結，方便查看來源與後續更新。

## 使用方式

### Copy Selection

複製目前在 Evernote Web 中反白選取的內容。這是主要功能，適合只複製筆記中的一段文字、表格、圖片或混合內容。

### Copy Active Note

複製目前正在編輯或閱讀的筆記正文。這是備援功能，適合沒有先反白選取內容，或想一次複製整則筆記正文時使用。

由於 Evernote Web 是單頁應用程式，Active Note 會依照頁面 DOM 判斷最像筆記正文的區塊；如果複製結果包含多餘 UI，請改用 Copy Selection。

## 快捷鍵

- `Alt+Shift+C`: Copy Selection。
- `Alt+Shift+N`: Copy Active Note。

如果快捷鍵沒有反應，請到 `chrome://extensions/shortcuts` 或 `edge://extensions/shortcuts` 檢查是否已綁定成功。Chrome / Edge 有時會因為快捷鍵衝突而不自動套用 manifest 裡的預設值。Windows 的語言切換設定也可能攔截 `Alt+Shift`，遇到這種情況可以在該頁面改成其他快捷鍵。

## 目前限制

- Evernote Web 的內部 DOM 可能變動，因此 Copy Active Note 使用保守的判斷規則。
- 圖片嵌入取決於瀏覽器能否用目前 Evernote 登入狀態讀取圖片 URL。若讀取失敗，擴充功能會保留原始圖片 URL。
- 過大的圖片會略過嵌入，避免剪貼簿資料量過大。
- 本擴充功能只適用於 Evernote Web，無法讀取 Evernote Desktop app 內部內容。

## 專案結構

```text
.
|-- manifest.json
|-- icons/
|-- src/
|   |-- background.js
|   |-- content.js
|   |-- popup.css
|   |-- popup.html
|   `-- popup.js
`-- docs/
    `-- privacy.md
```

## 開發檢查

在專案根目錄執行：

```powershell
node --check src\content.js
node --check src\popup.js
node --check src\background.js
Get-Content -Raw manifest.json | ConvertFrom-Json | Out-Null
```
