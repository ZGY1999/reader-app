import { useEffect, useState } from 'react';
import { api } from '../api';

interface SettingsData {
  fontSize?: string;
  lineHeight?: string;
  fontFamily?: string;
  theme?: string;
  aiApiKey?: string;
  aiBaseUrl?: string;
  ttsVoice?: string;
  ttsRate?: string;
}

const defaultSettings: Required<SettingsData> = {
  fontSize: '16',
  lineHeight: '1.8',
  fontFamily: 'system-ui',
  theme: 'light',
  aiApiKey: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  ttsRate: '1',
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const aiConfigured = Boolean(settings.aiApiKey?.trim());
  const aiBaseUrl = settings.aiBaseUrl?.trim() || defaultSettings.aiBaseUrl;
  const ttsVoice = settings.ttsVoice?.trim() || defaultSettings.ttsVoice;
  const ttsRate = settings.ttsRate?.trim() || defaultSettings.ttsRate;

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    const loadedSettings = { ...defaultSettings, ...await api.settings.getAll() };
    setSettings(loadedSettings);
    applySettings(loadedSettings);
  };

  const handleChange = async (key: keyof SettingsData, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await api.settings.save(key, value);
    applySettings({ [key]: value });
  };

  const applySettings = (nextSettings: Partial<SettingsData>) => {
    const root = document.documentElement;
    if (nextSettings.fontSize) root.style.setProperty('--font-size', `${nextSettings.fontSize}px`);
    if (nextSettings.lineHeight) root.style.setProperty('--line-height', nextSettings.lineHeight);
    if (nextSettings.fontFamily) root.style.setProperty('--font-family', nextSettings.fontFamily);
    if (nextSettings.theme) root.setAttribute('data-theme', nextSettings.theme);
  };

  return (
    <div className="settings-page">
      <h2>设置</h2>

      <section>
        <h3>字体设置</h3>
        <label>
          字号: {settings.fontSize}px
          <input
            type="range"
            min="12"
            max="24"
            value={settings.fontSize}
            onChange={(event) => handleChange('fontSize', event.target.value)}
          />
        </label>

        <label>
          行距: {settings.lineHeight}
          <input
            type="range"
            min="1.2"
            max="2.5"
            step="0.1"
            value={settings.lineHeight}
            onChange={(event) => handleChange('lineHeight', event.target.value)}
          />
        </label>
      </section>

      <section>
        <h3>主题</h3>
        <label>
          <input
            type="radio"
            checked={settings.theme === 'light'}
            onChange={() => handleChange('theme', 'light')}
          />
          日间
        </label>
        <label>
          <input
            type="radio"
            checked={settings.theme === 'dark'}
            onChange={() => handleChange('theme', 'dark')}
          />
          夜间
        </label>
      </section>

      <section>
        <h3>AI 问书</h3>
        <p>当前状态：{aiConfigured ? '已配置' : '未配置'}</p>
        <p>
          {aiConfigured
            ? `当前将使用 ${settings.aiApiKey} 连接 ${aiBaseUrl}`
            : `当前将使用 ${aiBaseUrl}，补充 AI API Key 后即可在阅读页提问。`}
        </p>
        <p>保存即生效，阅读页会立即按当前配置启用 AI 问书。</p>
        <label>
          AI API Key
          <input
            type="password"
            value={settings.aiApiKey}
            onChange={(event) => handleChange('aiApiKey', event.target.value)}
          />
        </label>

        <label>
          AI Base URL
          <input
            type="url"
            value={settings.aiBaseUrl}
            onChange={(event) => handleChange('aiBaseUrl', event.target.value)}
          />
        </label>

        <p>阅读功能默认可用；AI 需要配置 API Key 后启用。</p>
      </section>

      <section>
        <h3>TTS 朗读</h3>
        <p>当前配置：{ttsVoice} / {ttsRate}x</p>
        <p>保存即生效，阅读页会立即按当前 voice 和 rate 合成朗读音频。</p>
        <label>
          TTS Voice
          <input
            type="text"
            value={settings.ttsVoice}
            onChange={(event) => handleChange('ttsVoice', event.target.value)}
          />
        </label>

        <label>
          TTS Rate
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.ttsRate}
            onChange={(event) => handleChange('ttsRate', event.target.value)}
          />
          <span>{settings.ttsRate}x</span>
        </label>

        <p>默认使用 Edge TTS；如环境受限，朗读会在阅读页显示错误信息。</p>
      </section>
    </div>
  );
}
