# 计划：API 预设模板 + 软件更新

## Context

1. **API 预设模板**：内置 7 家服务商，用户选完只需填 API Key。
   - 模型字段不维护具体模型清单，按「厂商名」填充（可手动改成实际模型 ID）。
   - 选服务商后跳转官网：开关**默认开启**，选择后弹确认（确认/取消）→ `shell.openExternal`。
2. **实时翻译**：先不做。
3. **软件更新**：新增「检查更新」按钮；通过可配置更新地址获取版本清单，发现新版本后提示并打开下载页（轻量方案，无需先打包；后续可升级为 electron-updater 自动安装）。

现状：API provider 的 model 是自由文本；应用未打包、`npm start` 运行。

## Approach

### 1. API 预设 + 跳转

- `src/presets.js`：`PRESETS = [{ id, name, baseUrl, website, model }]`（7 家，model 用厂商名）。
- config 增 `apiJumpToSite: true`。
- 设置「在线 API」区增「服务商模板」下拉（默认自定义）：选中后填充 name/baseUrl/model 并记录 website。
- 选中模板且开关开启 → `dialog.showMessageBox` 确认 → `shell.openExternal(website)`。

### 2. 软件更新（轻量）

- `src/updater.js`：`checkUpdate(updateUrl, currentVersion)` → fetch `<updateUrl>/latest.json`（`{ version, url, notes }`）→ 语义化版本比较 → `{ hasUpdate, version, url, notes }`。
- config 增 `updateUrl: ''`。
- 「软件设置」tab 增「软件更新」区：显示当前版本（读 package.json）、更新地址输入、「检查更新」按钮；有新版 → 确认弹窗 → `shell.openExternal(url)`。

## Files to modify（拟）

```
src/presets.js                # 服务商预设
src/updater.js                # 更新检查（fetch + 版本比较）
src/config.js                 # apiJumpToSite / updateUrl
src/main.js                   # 跳转确认+openExternal、检查更新 IPC
src/preload.js                # check-update / open-external IPC
src/renderer/settings.html/js/css  # 模板下拉/跳转开关/更新区
test/presets.test.js / test/updater.test.js
```

## Reuse

- `src/config.js` load/saveConfig；`dialog.showMessageBox`；`shell.openExternal`。
- 现有 provider 编辑逻辑（模板选择只做字段填充）。

## Steps

- [x] 1. presets.js + updater.js + config（apiJumpToSite/updateUrl）+ 测试
- [x] 2. 设置 UI：服务商模板下拉 + 跳转开关 + 确认跳转
- [x] 3. main/preload：跳转确认 + 检查更新 IPC
- [x] 4. 软件更新区 UI（版本/更新地址/检查更新按钮）
- [ ] 5. 测试 + 冒烟 + 提交

## Verification

- 单元测试：presets 结构、版本比较、manifest 解析。
- 手动：选模板自动填 baseUrl/模型；跳转开关/确认生效；更新区显示版本、点击检查更新有反馈。
