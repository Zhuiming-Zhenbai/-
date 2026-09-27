'use strict';

/**
 * 语义化版本比较：a > b 返回 1，a < b 返回 -1，相等返回 0。
 */
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/**
 * 检查更新：从 `<updateUrl>/latest.json` 读取 `{ version, url, notes }`。
 * @param {string} updateUrl 更新清单所在基础地址
 * @param {string} currentVersion 当前版本
 * @param {object} [options] { fetchImpl }
 * @returns {Promise<object>} { hasUpdate, version, url, notes, currentVersion }
 */
async function checkUpdate(updateUrl, currentVersion, options = {}) {
  const { fetchImpl = fetch } = options;
  if (!updateUrl) {
    return { hasUpdate: false, reason: '未配置更新地址', currentVersion };
  }
  const manifestUrl = String(updateUrl).replace(/\/+$/, '') + '/latest.json';
  const res = await fetchImpl(manifestUrl);
  if (!res.ok) {
    throw new Error(`获取更新信息失败：${res.status}`);
  }
  const m = await res.json();
  if (!m || typeof m.version !== 'string') {
    throw new Error('更新信息格式错误');
  }
  const hasUpdate = compareVersions(m.version, currentVersion) > 0;
  return {
    hasUpdate,
    version: m.version,
    url: m.url || '',
    notes: m.notes || '',
    currentVersion,
  };
}

module.exports = { checkUpdate, compareVersions };
