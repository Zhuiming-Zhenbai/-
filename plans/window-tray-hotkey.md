# 功能增强：窗口自适应/可调、关闭行为、快捷键设置

## Context

在 MVP 基础上增加三项能力（已与用户确认具体形态）：

1. **翻译窗**：长句翻译时窗口太小看不全 → 支持手动调整大小 + 根据译文自动调节大小；保持现有「无边框置顶、鼠标附近、失焦隐藏」等行为。
   - **设置窗**：支持最大化、最小化、关闭。
2. **关闭行为**：设置里可选「点击关闭时 → 后台运行（托盘）/ 直接退出应用」。
3. **快捷键设置**：显示当前/默认按键；旁有「更改」按钮（点击后直接读取用户按键，弹确认框，确认后生效）与「重置」按钮（退回默认 `Alt+Q`）。

## Approach

### 1. 窗口调整

- 设置窗：`resizable/minimizable/maximizable: true`，加 `minWidth/minHeight`，CSS 改流式布局。
- 翻译窗：保持 `frame:false + transparent + alwaysOnTop + 失焦隐藏 + 鼠标定位`。
  - 手动调整大小：transparent 窗口无原生边缘缩放，改用**右下角拖拽手柄**（`mousedown→mousemove` 经 IPC 通知主进程 `setSize`，主进程 clamp 并重新定位）。
  - 内容自适应：渲染进程测量译文自然尺寸（宽=最宽行，高=原文+译文+头部/底部），经 IPC 请求主进程 `setSize`，clamp 到 [最小 320×160, 最大 560×min(600,工作区高-40)]；每次新译文到达时自动适配一次，用户可再手动调整。

### 2. 关闭行为

- `config.js` 新增 `closeToTray: true`（默认）。
- 设置窗新增单选：`后台运行（最小化到托盘）` / `退出程序`。
- `main.js`：`settingsWindow` 的 `close` 事件按 `config.closeToTray` 决定 `app.quit()` 或仅关闭；`window-all-closed` 在非后台模式时退出；托盘「退出」始终退出。

### 3. 快捷键设置增强

- 设置窗快捷键区：只读显示当前按键 + 「更改」+「重置」按钮。
- 「更改」→ 进入录入态，监听 `keydown` 组合键 → 转成 Electron Accelerator（映射 Control/Shift/Alt/Super + 键名）→ 经 IPC 用 `dialog.showMessageBox` 弹确认 → 确认后 `save-settings` 重注册。
- 「重置」→ 确认后恢复默认 `Alt+Q`。
- 复用现有 `save-settings`（主进程已做注册校验与回退）。

## Files to modify

```
src/main.js                  # 窗口选项、关闭行为、resize/confirm IPC、setSize
src/config.js                # DEFAULTS 增 closeToTray
src/preload.js               # 增 resizeToContent / resizeBy / confirmHotkey / confirmReset
src/renderer/index.html      # 右下角拖拽手柄
src/renderer/renderer.js     # 内容测量 + 手柄拖拽 + IPC 调用
src/renderer/style.css       # 手柄样式、布局适配
src/renderer/settings.html   # 快捷键录入 UI + 关闭行为单选
src/renderer/settings.js     # 录入态逻辑 + 确认 + 重置
src/renderer/settings.css    # 布局适配
test/config.test.js          # 新增 closeToTray 读写测试
```

## Reuse

- `src/main.js`：`createPopupWindow()` / `createSettingsWindow()` / `registerShortcut()` / `positionPopupNearCursor()` / `save-settings` IPC。
- `src/config.js`：`loadConfig/saveConfig`（扩展 DEFAULTS）。
- `globalShortcut` / `dialog` / `screen` Electron 原生能力。

## Steps

- [x] 1. `config.js` 增 `closeToTray` 默认值 + 测试
- [x] 2. 设置窗可最大化/最小化/关闭 + 流式布局
- [x] 3. 翻译窗内容自适应（测量 + IPC + 主进程 setSize/clamp/重定位）
- [x] 4. 翻译窗右下角拖拽手柄手动调整大小
- [x] 5. 关闭行为设置（设置窗单选 + main 按配置处理 close/退出）
- [x] 6. 快捷键录入/确认/重置 UI 与 IPC
- [ ] 7. `npm test` + 启动冒烟 + 手动验证 + 提交

## Verification

- 单元测试：`closeToTray` 默认值与读写；`npm test` 全绿。
- 手动：
  - 翻译一段长文本 → 窗口自动变大；拖动右下角可缩放；失焦仍隐藏、置顶仍在。
  - 设置窗可最大化/最小化/关闭。
  - 关闭行为选「退出程序」后关设置窗 → 应用退出；选「后台运行」→ 关窗后托盘仍在。
  - 快捷键「更改」按组合键 → 确认框 → 保存后生效；「重置」→ 回到 `Alt+Q`。
