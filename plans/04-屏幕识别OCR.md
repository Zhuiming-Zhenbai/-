# 计划：屏幕识别（OCR）翻译模块

## Context

新增「屏幕识别」模块：可移动、可调大小的透明置顶窗口，框住屏幕上无法直接选中的内容（如图片文字），只翻译窗口框住的区域。

已确认决策：
1. OCR 语言：识别窗口内放**下拉框**（自动 / 英文 / 日文 / 中文），默认自动（中英日混合）。
2. 打开方式：托盘菜单「屏幕识别」+ **可自定义全局快捷键**（默认 `Alt+W`，设置里像翻译快捷键一样可更改/重置）。
3. 截图时窗口会短暂闪烁（隐藏再恢复），可接受。
4. OCR 引擎：**tesseract.js**（WASM、免原生模块；语言数据首次使用自动下载缓存）。

现状（已读代码）：
- `src/translate.js` 调度器（在线 / 离线）可直接复用。
- 翻译弹窗的置顶/透明/拖拽/缩放手柄模式可借鉴。
- `src/config.js` DEFAULTS：`{ apiKey, hotkey, closeToTray, engineMode, providers, activeProviderId, offline }`。

## Approach

### 1. 配置与快捷键

- `config.js` DEFAULTS 增：`ocrHotkey: 'Alt+W'`、`ocrLang: 'auto'`。
- `main.js`：`registerShortcut` 重构为注册两个快捷键（翻译 + OCR）；`onOcrHotkey` 打开/聚焦识别窗；`save-settings` 校验两个快捷键，失败回退并报错。
- 设置窗新增「屏幕识别快捷键」行（显示当前 + 更改 + 重置，复用现有按键录入与确认弹窗逻辑，把录入逻辑抽成通用函数）。
- `get-settings` 返回 `ocrHotkey/defaultOcrHotkey/ocrLang`。

### 2. 识别窗口（新窗口）

- `frame:false + transparent + alwaysOnTop + skipTaskbar`，可见边框（指示截取范围）+ 顶部工具条：
  `[语言下拉] [翻译] [原文/译文切换] [复制] [×]`。
- 工具条 `-webkit-app-region: drag`（按钮/下拉 no-drag）实现拖动。
- **四角拖拽手柄**调整大小（nw/ne/sw/se，含窗口位置联动，经 IPC `set-ocr-bounds` 由主进程 `setBounds` + 最小尺寸 clamp）。
- 结果展示区：半透明面板，可滚动，显示译文或原文（按「隐藏」按钮切换：显示译文→点击→隐藏译文显示原文→再点恢复译文）；「复制」复制当前显示内容。
- 语言下拉变化经 IPC `set-ocr-lang` 持久化到 config。

### 3. 截图采集（主进程）

- 点「翻译」→ 记录窗口 `getBounds()` → **`win.hide()`** → 等 ~150ms → `desktopCapturer.getSources({ types:['screen'] })` → 按 `source.display_id` 选窗口所在显示器（MVP 主屏优先，多屏尽力）→ `nativeImage.crop`（区域 = `bounds - display.bounds` × `scaleFactor`）→ PNG Buffer → `win.show()` 恢复。

### 4. OCR（tesseract.js）

- 新依赖 `tesseract.js`；新模块 `src/ocr.js`：`recognize(imageBuffer, lang, { cacheDir }) → text`。
- 语言映射：`auto → eng+chi_sim+jpn`、`en → eng`、`ja → jpn`、`zh → chi_sim`。
- `langPath` 指向 `userData/tessdata`；语言数据首次使用自动下载（国内镜像，与离线模型同一策略）并缓存；worker 按需懒加载并复用（语言变化时重建）。

### 5. OCR → 翻译流程

- `ipcMain.handle('ocr-translate', lang)`：截图 → OCR → `src/translate.js`（跟随当前引擎：在线 API / 离线模型）→ 返回 `{ original, translation }`。
- 渲染进程期间显示「识别中… / 翻译中…」状态。

## Files to modify（拟）

```
src/ocr.js                     # tesseract.js 封装
src/config.js                  # ocrHotkey / ocrLang
src/main.js                    # 识别窗、托盘入口、双快捷键、截图采集、ocr-translate/set-ocr-bounds/set-ocr-lang IPC
src/preload.js                 # 识别窗 IPC
src/renderer/settings.html/js  # OCR 快捷键行（更改/重置）
src/renderer/ocr/index.html    # 识别窗 UI（工具条/四角手柄/内容区）
src/renderer/ocr/renderer.js
src/renderer/ocr/style.css
package.json                   # + tesseract.js
test/ocr.test.js               # 语言映射等纯逻辑
```

## Reuse

- `src/translate.js` 的 `translate(text, config, options)`。
- `src/main.js`：窗口模式（置顶/透明/拖拽/缩放）、`clipboard`、托盘菜单、快捷键注册。
- `src/renderer` 弹窗的缩放手柄与样式模式。
- Electron 内置 `desktopCapturer` / `screen` / `nativeImage.crop`。

## Steps

- [x] 1. config 增 ocrHotkey/ocrLang + 测试
- [x] 2. 装 tesseract.js + `src/ocr.js` 封装（语言映射 + 懒加载 worker）+ 测试
- [x] 3. 主进程：截图采集（隐藏→截屏→裁剪→恢复，DPI/多屏处理）
- [x] 4. 识别窗 UI：工具条/拖拽/四角缩放/原文译文切换/复制/关闭
- [x] 5. 托盘入口 + 双快捷键注册 + 设置窗 OCR 快捷键行
- [x] 6. OCR→翻译流程串联（状态提示）
- [ ] 7. 测试 + 冒烟 + 提交

## Verification

- 单元测试：OCR 语言映射、config 新字段、快捷键相关逻辑。
- 手动：
  - 托盘/`Alt+W` 打开识别窗；拖动、四角缩放。
  - 框住图片文字 → 翻译 → 正确识别并显示译文；「隐藏」按钮在原文/译文间切换；复制当前内容；× 关闭。
  - 设置里更改 OCR 快捷键生效；语言下拉切换生效。
  - 在线/离线引擎下均可使用（离线需先有模型）。
