import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useBookStore } from '../store';
import '../styles/settings.css';

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
  const navigate = useNavigate();
  const currentBook = useBookStore((state) => state.currentBook);
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const aiConfigured = Boolean(settings.aiApiKey?.trim());
  const aiBaseUrl = settings.aiBaseUrl?.trim() || defaultSettings.aiBaseUrl;
  const ttsVoice = settings.ttsVoice?.trim() || defaultSettings.ttsVoice;
  const ttsRate = settings.ttsRate?.trim() || defaultSettings.ttsRate;
  const ttsReady = Boolean(ttsVoice);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    const loadedSettings = { ...defaultSettings, ...await api.settings.getAll() };
    setSettings(loadedSettings);
  };

  const handleChange = async (key: keyof SettingsData, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await api.settings.save(key, value);
  };

  const handleRestoreDefaults = async () => {
    const resetValues: Partial<SettingsData> = {
      fontSize: defaultSettings.fontSize,
      lineHeight: defaultSettings.lineHeight,
      theme: defaultSettings.theme,
    };

    setSettings((prev) => ({ ...prev, ...resetValues }));
    await Promise.all([
      api.settings.save('fontSize', defaultSettings.fontSize),
      api.settings.save('lineHeight', defaultSettings.lineHeight),
      api.settings.save('theme', defaultSettings.theme),
    ]);
  };

  const handleBack = () => {
    navigate(currentBook ? '/reader' : '/');
  };

  return (
    <div className="settings-shell">
      <div className="settings-page">
        <header className="settings-hero" data-testid="settings-hero">
          <div className="settings-hero__actions">
            <button type="button" className="settings-back-button" onClick={handleBack}>
              {currentBook ? '返回阅读' : '返回书架'}
            </button>
          </div>
          <div className="settings-hero__copy">
            <span className="settings-eyebrow">Reader Control Center</span>
            <h2>{'设置'}</h2>
            <p>{'这里仅负责阅读偏好、AI 基础配置和 TTS 配置状态。字号、行距和主题只会影响阅读内容本身，不会放大整个界面。'}</p>
          </div>
        </header>

        <div className="settings-grid">
          <section className="settings-card" data-testid="settings-card-reading">
            <div className="settings-card__header">
              <div>
                <span className="settings-card__eyebrow">Reading</span>
                <h3>{'阅读外观'}</h3>
              </div>
              <div className="settings-card__actions">
                <span className="settings-badge settings-badge--neutral">{'仅影响正文'}</span>
                <button type="button" className="settings-reset-button" onClick={() => void handleRestoreDefaults()}>
                  {'恢复默认'}
                </button>
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="font-size">{'字号'}</label>
              <div className="settings-slider-row">
                <input
                  aria-label={'字号'}
                  id="font-size"
                  type="range"
                  min="12"
                  max="24"
                  value={settings.fontSize}
                  onChange={(event) => void handleChange('fontSize', event.target.value)}
                />
                <span>{settings.fontSize}px</span>
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="line-height">{'行距'}</label>
              <div className="settings-slider-row">
                <input
                  aria-label={'行距'}
                  id="line-height"
                  type="range"
                  min="1.2"
                  max="2.5"
                  step="0.1"
                  value={settings.lineHeight}
                  onChange={(event) => void handleChange('lineHeight', event.target.value)}
                />
                <span>{settings.lineHeight}</span>
              </div>
            </div>

            <div className="settings-theme-group">
              <span className="settings-theme-group__label">{'主题'}</span>
              <label className="settings-choice">
                <input
                  aria-label={'日间'}
                  type="radio"
                  checked={settings.theme === 'light'}
                  onChange={() => void handleChange('theme', 'light')}
                />
                <span>{'日间'}</span>
              </label>
              <label className="settings-choice">
                <input
                  aria-label={'夜间'}
                  type="radio"
                  checked={settings.theme === 'dark'}
                  onChange={() => void handleChange('theme', 'dark')}
                />
                <span>{'夜间'}</span>
              </label>
            </div>
          </section>

          <section className="settings-card" data-testid="settings-card-ai">
            <div className="settings-card__header">
              <div>
                <span className="settings-card__eyebrow">AI</span>
                <h3>{'AI 配置'}</h3>
              </div>
              <span className={`settings-badge ${aiConfigured ? 'settings-badge--ready' : 'settings-badge--pending'}`}>
                {aiConfigured ? '已配置' : '未配置'}
              </span>
            </div>

            <p className="settings-summary">
              {aiConfigured
                ? `当前将使用 ${settings.aiApiKey} 连接 ${aiBaseUrl}`
                : `当前连接目标为 ${aiBaseUrl}，补全 AI API Key 后即可在阅读页右侧工具抽屉里提问。`
              }
            </p>
            <p className="settings-note">{'保存即生效。设置页只负责配置和可用状态，不承载 AI 对话本身。'}</p>

            <div className="settings-field">
              <label htmlFor="ai-api-key">AI API Key</label>
              <input
                id="ai-api-key"
                className="settings-input"
                type="password"
                value={settings.aiApiKey}
                onChange={(event) => void handleChange('aiApiKey', event.target.value)}
              />
            </div>

            <div className="settings-field">
              <label htmlFor="ai-base-url">AI Base URL</label>
              <input
                id="ai-base-url"
                className="settings-input"
                type="url"
                value={settings.aiBaseUrl}
                onChange={(event) => void handleChange('aiBaseUrl', event.target.value)}
              />
            </div>
          </section>

          <section className="settings-card" data-testid="settings-card-tts">
            <div className="settings-card__header">
              <div>
                <span className="settings-card__eyebrow">Speech</span>
                <h3>{'TTS 配置'}</h3>
              </div>
              <span className={`settings-badge ${ttsReady ? 'settings-badge--ready' : 'settings-badge--pending'}`}>
                {ttsReady ? '可用' : '未配置'}
              </span>
            </div>

            <p className="settings-summary">{'当前配置：'}{ttsVoice} / {ttsRate}x</p>
            <p className="settings-note">{'保存即生效。这里展示当前将使用的语音和语速，以及 TTS 是否已准备好。'}</p>

            <div className="settings-field">
              <label htmlFor="tts-voice">TTS Voice</label>
              <input
                id="tts-voice"
                className="settings-input"
                type="text"
                value={settings.ttsVoice}
                onChange={(event) => void handleChange('ttsVoice', event.target.value)}
              />
            </div>

            <div className="settings-field">
              <label htmlFor="tts-rate">TTS Rate</label>
              <div className="settings-slider-row">
                <input
                  id="tts-rate"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.ttsRate}
                  onChange={(event) => void handleChange('ttsRate', event.target.value)}
                />
                <span>{settings.ttsRate}x</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
