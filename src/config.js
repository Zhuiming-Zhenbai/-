'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SYSTEM_PROMPT =
  '你是翻译助手。把用户输入翻译成简体中文，只输出译文，不要任何解释、注释或额外内容。';

const DEFAULTS = {
  apiKey: '', // 旧字段，仅用于迁移
  hotkey: 'Alt+Q',
  closeToTray: true,
  engineMode: 'online', // 'online' | 'offline'
  providers: [],
  activeProviderId: '',
  offline: {
    sourceLang: 'auto', // 'auto' | 'en' | 'ja'
    remoteHost: 'https://hf-mirror.com/',
  },
  ocrHotkey: 'Alt+W',
  ocrLang: 'auto', // 'auto' | 'en' | 'ja' | 'zh'
  ocrBorderColor: '#1f6feb',
  apiJumpToSite: true,
  updateUrl: '',
};

function makeDefaultProvider(apiKey = '') {
  return {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: apiKey || '',
    model: 'deepseek-chat',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    enabled: true,
  };
}

function configFilePath(dir) {
  return path.join(dir, 'config.json');
}

/**
 * 迁移旧配置：旧版本只有 apiKey，没有 providers 数组。
 */
function migrateRaw(raw) {
  const out = { ...raw };
  if (!Array.isArray(out.providers) || out.providers.length === 0) {
    const p = makeDefaultProvider(out.apiKey);
    out.providers = [p];
    out.activeProviderId = p.id;
  } else if (!out.providers.some((p) => p.id === out.activeProviderId)) {
    const target = out.providers.find((p) => p.enabled !== false) || out.providers[0];
    out.activeProviderId = target ? target.id : '';
  }
  return out;
}

function mergeConfig(raw) {
  return {
    ...DEFAULTS,
    ...raw,
    offline: { ...DEFAULTS.offline, ...(raw.offline || {}) },
  };
}

/**
 * 读取配置，文件不存在或解析失败时回退到默认值（并做迁移）。
 * @param {string} dir userData 目录
 */
function loadConfig(dir) {
  const file = configFilePath(dir);
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    raw = {};
  }
  return mergeConfig(migrateRaw(raw));
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
 * 解析 API Key：优先环境变量 DEEPSEEK_API_KEY，其次 provider 的 apiKey。
 * @param {object} providerOrCfg
 */
function resolveApiKey(providerOrCfg) {
  const env = process.env.DEEPSEEK_API_KEY;
  if (env && env.trim()) {
    return env.trim();
  }
  return (providerOrCfg && providerOrCfg.apiKey) || '';
}

/**
 * 返回当前生效的 provider（优先 activeProviderId 且启用；否则第一个启用的；再否则第一个）。
 * @param {object} cfg
 */
function getActiveProvider(cfg) {
  const list = Array.isArray(cfg.providers) ? cfg.providers : [];
  const active = list.find((p) => p.id === cfg.activeProviderId && p.enabled !== false);
  return active || list.find((p) => p.enabled !== false) || list[0] || null;
}

module.exports = {
  DEFAULTS,
  DEFAULT_SYSTEM_PROMPT,
  makeDefaultProvider,
  loadConfig,
  saveConfig,
  resolveApiKey,
  getActiveProvider,
};
