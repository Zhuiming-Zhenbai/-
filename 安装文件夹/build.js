'use strict';

// 打包脚本：从项目根目录运行 `node 安装文件夹/build.js [--dir]`
//   - 无参数：生成安装版 + 便携版（读 electron-builder.yml 的 win.target）
//   - --dir：只生成解包目录（调试用，更快）
const path = require('node:path');
const { build } = require('electron-builder');

const configPath = path.join(__dirname, 'electron-builder.yml');
const dirOnly = process.argv.includes('--dir');

build({ config: configPath, dir: dirOnly }).catch((err) => {
  console.error(err);
  process.exit(1);
});
