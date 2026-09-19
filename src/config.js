'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = {
  apiKey: '',
  hotkey: 'Alt+Q',
};

function configFilePath(dir) {
  return path.join(dir, 'config.json');
}

/**
 * 读取配置，文件不存在或解析失败时回退到默认值。
 * @param {string} dir userData 目录
 */
function loadConfig(dir) {
  const file = configFilePath(dir);
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * 保存配置。
 * @param {string} dir userData 目录
 * @param {object} cfg
 */
function saveConfig(dir, cfg) {
  const file = configFilePath(dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...DEFAULTS, ...cfg }, null, 2), 'utf8');
}

/**
 * 解析 API Key：优先环境变量 DEEPSEEK_API_KEY，其次配置文件。
 * @param {object} cfg
 */
function resolveApiKey(cfg) {
  const env = process.env.DEEPSEEK_API_KEY;
  if (env && env.trim()) {
    return env.trim();
  }
  return (cfg && cfg.apiKey) || '';
}

module.exports = { DEFAULTS, loadConfig, saveConfig, resolveApiKey };
