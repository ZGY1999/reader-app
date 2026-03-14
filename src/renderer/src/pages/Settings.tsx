import { useState, useEffect } from 'react';

interface SettingsData {
  fontSize?: string;
  lineHeight?: string;
  fontFamily?: string;
  theme?: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>({
    fontSize: '16',
    lineHeight: '1.8',
    fontFamily: 'system-ui',
    theme: 'light'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await window.electron.ipcRenderer.invoke('settings:getAll');
    setSettings(prev => ({ ...prev, ...data }));
  };

  const handleChange = async (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    await window.electron.ipcRenderer.invoke('settings:save', key, value);
    applySettings(key, value);
  };

  const applySettings = (key: string, value: string) => {
    const root = document.documentElement;
    if (key === 'fontSize') root.style.setProperty('--font-size', value + 'px');
    if (key === 'lineHeight') root.style.setProperty('--line-height', value);
    if (key === 'fontFamily') root.style.setProperty('--font-family', value);
    if (key === 'theme') root.setAttribute('data-theme', value);
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
