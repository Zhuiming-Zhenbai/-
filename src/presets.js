'use strict';

// 内置服务商预设模板（模型字段按厂商名填充，用户可自行修改为实际模型 ID）
const PRESETS = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', website: 'https://platform.deepseek.com', model: 'DeepSeek' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', website: 'https://platform.openai.com', model: 'OpenAI' },
  { id: 'moonshot', name: 'Kimi（月之暗面）', baseUrl: 'https://api.moonshot.cn/v1', website: 'https://platform.moonshot.cn', model: 'Kimi' },
  { id: 'qwen', name: '通义千问（阿里）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', website: 'https://bailian.console.aliyun.com', model: '通义千问' },
  { id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', website: 'https://open.bigmodel.cn', model: 'GLM' },
  { id: 'baidu', name: '百度千帆', baseUrl: 'https://qianfan.baidubce.com/v2', website: 'https://qianfan.cloud.baidu.com', model: '文心一言' },
  { id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', website: 'https://siliconflow.cn', model: 'SiliconFlow' },
];

function getPresetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

module.exports = { PRESETS, getPresetById };
