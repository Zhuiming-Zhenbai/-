# 电脑翻译软件 MVP 计划

## Context

- 目标：做一个「翻译鼠标选中内容」的 Windows 桌面软件，MVP 先行。
- 需求决策（已确认）：
  1. 翻译引擎：DeepSeek 官方 API
  2. 交互：选中文本 → 按全局快捷键 → 弹出翻译
  3. 目标语言：固定中文（自动检测源语言）
  4. 平台：仅 Windows
  5. 技术栈：Electron
- 环境：Windows，Node.js v22.23.2 / npm 10.9.8 已就绪。
- 当前仓库为空（仅 AGENTS.md），全新项目。

## Approach

用 **Electron** 实现一个托盘常驻应用：

- **主进程**：系统托盘图标 + 注册全局快捷键（默认 `Alt+Q`，可配置）。
- **选中文本捕获**：触发快捷键时，通过 PowerShell `WScript.Shell.SendKeys("^c")` 向当前聚焦窗口发送 Ctrl+C，等待约 150ms 后读取剪贴板文本作为「选中内容」；读取前保存、读取后恢复用户原剪贴板（仅文本）。
- **翻译**：调用 DeepSeek（OpenAI 兼容）`POST https://api.deepseek.com/chat/completions`，模型 `deepseek-chat`，system 提示「把输入翻译成中文，只输出译文」。
- **结果弹窗**：无边框、置顶、不占任务栏的小窗，定位在鼠标附近，显示原文 + 译文，含「复制译文」按钮，ESC / 失焦关闭。
- **设置**：首次运行弹设置窗让用户填 API Key，存入 `app.getPath('userData')/config.json`；也可改快捷键。
- **安全**：`contextIsolation: true`、`nodeIntegration: false`，通过 preload 暴露最小 API。

## Files to modify（拟建）

```
小白翻译/
├── package.json               # 依赖：electron（dev）；测试用 node:test 内置
├── src/
│   ├── main.js                # 主进程：托盘、全局快捷键、窗口管理、流程编排
│   ├── selection.js           # 选中文本捕获（PowerShell SendKeys + 剪贴板保存/恢复）
│   ├── translate.js           # DeepSeek 翻译封装（可注入 fetch 便于测试）
│   ├── config.js              # API Key / 快捷键的读写（userData/config.json）
│   ├── preload.js             # contextBridge 暴露 IPC
│   └── renderer/
│       ├── index.html         # 结果弹窗
│       ├── settings.html      # 设置窗（API Key、快捷键）
│       ├── renderer.js
│       └── style.css
├── assets/icon.ico            # 托盘/窗口图标（占位）
└── test/
    ├── translate.test.js      # 翻译请求体、解析、异常
    └── config.test.js         # 配置读写
```

## Reuse

- Node.js v22（Electron 主进程运行时）。
- Node 内置 `fetch`（主进程调用 DeepSeek，无需额外依赖）。
- Electron 内置 `clipboard` / `globalShortcut` / `screen`。
- Node 内置 `node:test`（单元测试，零额外依赖）。

## Steps

- [x] 1. `npm init` + 安装 `electron`（devDependency），配置 `main` 与 `start` 脚本
- [x] 2. 实现 `config.js`：读写 userData/config.json（API Key、hotkey），支持 `DEEPSEEK_API_KEY` 环境变量覆盖
- [x] 3. 实现 `translate.js`：DeepSeek chat/completions 封装（模型 deepseek-chat，超时、错误处理）
- [x] 4. 实现 `selection.js`：PowerShell SendKeys 发送 Ctrl+C → 延时 → 读剪贴板 → 恢复原剪贴板
- [x] 5. 实现 `main.js`：托盘 + 全局快捷键 + 流程编排（捕获→翻译→弹窗）；无 API Key 时引导打开设置
- [x] 6. 实现弹窗（index.html/renderer.js/style.css）：置顶无边框、定位鼠标附近、复制译文、ESC/失焦关闭
- [x] 7. 实现设置窗（settings.html）：填 API Key、改快捷键
- [x] 8. 编写测试并通过（`node --test`）
- [x] 9. 按 AGENTS.md 要求提交 commit

## Verification

- 单元测试：`npm test`（翻译请求构造与解析、配置读写）全绿。
- 手动验证：在浏览器/记事本选中一段英文 → 按 `Alt+Q` → 弹窗显示正确中文译文；复制按钮可用；ESC/失焦关闭；重启后 API Key 仍在。
- 边界：未配置 API Key 时给出引导；剪贴板原为图片时不崩溃。

## 非目标（MVP 之后）

- 打包成安装程序（electron-builder）
- 翻译历史记录、多目标语言切换、OCR、划词自动翻译（无按键）
