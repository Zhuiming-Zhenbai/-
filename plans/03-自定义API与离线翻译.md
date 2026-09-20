# 计划：自定义 API 接入、离线翻译引擎、翻译窗可拖拽

## Context

在现有应用上新增三项能力（决策已确认）：

1. **自定义 API 接入**：支持 OpenAI 兼容接口，多套配置、可启用/停用、可切换当前使用。
2. **离线翻译引擎**：Node 原生离线翻译（`transformers.js` + ONNX Runtime），英文/日文 → 中文，随软件免装（模型首次自动下载缓存，之后纯离线）。
3. **翻译窗可拖拽位置**：拖动标题栏移动窗口。

**引擎开关（互斥）**：设置一个总开关「在线 API ↔ 离线翻译」，选在线时离线关闭，选离线时 API 关闭。

环境探查结论：
- `src/translate.js` 写死 DeepSeek；`src/config.js` DEFAULTS = `{ apiKey, hotkey, closeToTray }`。
- 离线模型调研：无直接 ja→zh 模型；有 `Xenova/opus-mt-en-zh`、`Xenova/opus-mt-ja-en`。故 ja→zh 走「ja→en→zh」两跳，en→zh 直接。

## Approach

### 1. 引擎开关 + Provider 配置

- `config.js` 新增：
  - `engineMode: 'online' | 'offline'`（默认 online，互斥开关）
  - `providers: []`（OpenAI 兼容配置列表），`activeProviderId`
  - `offline: { sourceLang: 'auto' | 'en' | 'ja' }`
  - 兼容迁移：首次加载若无 `providers`，用旧 `apiKey` 合成默认 DeepSeek 配置。
- 拆 provider 模块：
  - `src/providers/openai.js`（现有逻辑迁移：`baseUrl/apiKey/model/systemPrompt` 可配置）
  - `src/providers/offline.js`（transformers.js 离线）
- `src/translate.js` 改调度器：按 `engineMode` 与 `activeProviderId` 分发，`main.js` 传入。

### 2. 离线引擎（transformers.js）

- 依赖 `@huggingface/transformers` + `onnxruntime-node`（原生模块，需 `@electron/rebuild` 匹配 Electron ABI）。
- 模型：`Xenova/opus-mt-en-zh` + `Xenova/opus-mt-ja-en`（约 2×80MB），首次使用时下载到 userData 缓存，之后纯离线。
- 源语言：heuristic 自动检测（含日文假名 → ja，否则 en），可手动指定 en/ja。
- 翻译：en→zh 直接；ja→zh 两跳（ja→en→zh，en-zh 复用第二跳）。
- 加载优化：模型按需懒加载，启动时不阻塞。

### 3. 设置 UI

- 顶部「翻译引擎」开关：在线 API / 离线翻译（互斥）。
- 在线模式：配置列表（新增/编辑/删除，每条带启用开关，单选当前使用）；字段：名称、Base URL、API Key、模型、系统提示词。
- 离线模式：源语言（自动/英文/日文）。

### 4. 翻译窗拖拽

- 标题栏 `-webkit-app-region: drag`，关闭按钮 `no-drag`；拖动移动，位置会话内保持（下次自动定位前不变）。

## Files to modify（拟）

```
src/translate.js             # 改调度器
src/providers/openai.js      # 新增（从 translate.js 迁移）
src/providers/offline.js     # 新增（transformers.js + 语言检测）
src/config.js                # engineMode/providers/offline + 迁移
src/main.js                  # onHotkey/save-settings 接入 provider 与引擎开关
src/preload.js               # 设置窗 IPC（列表增删改、开关）
src/renderer/settings.html/js/css  # 引擎开关 + 配置列表 UI + 离线字段
src/renderer/index.html/style.css  # 标题栏拖拽
test/*.test.js               # openai 重构、离线命令/语言检测、config 迁移
package.json                 # 新增依赖 + rebuild 脚本
```

## Reuse

- `src/translate.js` 现有 OpenAI 兼容逻辑（迁移到 providers/openai.js）。
- `src/config.js` `loadConfig/saveConfig`（扩展 + 迁移）。
- `src/main.js` `onHotkey` / `save-settings` IPC / 设置窗结构。
- `src/renderer` 现有设置窗与弹窗结构。

## Steps

- [x] 1. config：engineMode/providers/offline + 迁移 + 测试
- [x] 2. providers/openai.js 迁移 + translate 调度器 + 测试
- [x] 3. 安装 transformers.js/onnxruntime + 离线引擎 + 语言检测 + 测试
- [x] 4. main 接入引擎开关与 provider + 设置窗配置列表 UI
- [x] 5. 翻译窗标题栏拖拽
- [x] 6. 测试 + 冒烟 + 提交

## Verification

- 单元测试：openai 请求构造、离线源语言检测（heuristic）、config 迁移、provider 开关/切换逻辑。
- 手动：
  - 引擎开关切「在线」→ 用所选 API 配置翻译；切「离线」→ 离线翻译，API 不调用。
  - 多套 API 配置可增删改、启用/停用、切换当前。
  - 离线：英文→中文、日文→中文均可（首次会下载模型）。
  - 拖动翻译窗标题栏可移动位置。

## 风险/备注

- onnxruntime-node 为原生模块，需 `@electron/rebuild`；若遇兼容问题可改在渲染进程用 WASM 版 onnxruntime 运行。
- 离线模型首次使用需联网下载一次（约 160MB），之后离线可用；打包版可后续把模型内置。

## 后续修改（第 3 次计划内补充）

- [x] 引擎开关切换时，未选中配置页「收起变灰」（`.section.disabled`：降低不透明度 + 禁用交互），而不是完全隐藏。
- [x] 离线配置页增加提示：离线翻译质量受小模型限制，长难句不如 DeepSeek 等大模型，推荐把短文拆分后分别翻译。
- [x] 翻译窗不再失焦自动隐藏，需用户自行关闭（× 按钮或 ESC）。
