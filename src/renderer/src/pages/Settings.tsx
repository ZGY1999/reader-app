import { useEffect, useState } from 'react';
import { api } from '../api';

interface SettingsData {
  fontSize?: string;
  lineHeight?: string;
  fontFamily?: string;
  theme?: string;
}

const defaultSettings: Required<SettingsData> = {
  fontSize: '16',
  lineHeight: '1.8',
  fontFamily: 'system-ui',
  theme: 'light',
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    const loadedSettings = { ...defaultSettings, ...await api.settings.getAll() };
    setSettings(loadedSettings);
    applySettings(loadedSettings);
  };

  const handleChange = async (key: keyof SettingsData, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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
            onChange={(e) => handleChange('fontSize', e.target.value)}
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
            onChange={(e) => handleChange('lineHeight', e.target.value)}
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
    </div>
  );
}
