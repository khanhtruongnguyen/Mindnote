import { useState, useEffect } from 'react';

export type DeviceMode = 'auto' | 'mobile' | 'desktop';

const STORAGE_MODE_KEY = 'nexus_device_mode_preference';

export function useDeviceMode() {
  const [preference, setPreference] = useState<DeviceMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MODE_KEY) as DeviceMode;
      return saved && ['auto', 'mobile', 'desktop'].includes(saved) ? saved : 'auto';
    } catch {
      return 'auto';
    }
  });

  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const changePreference = (newPref: DeviceMode) => {
    setPreference(newPref);
    try {
      localStorage.setItem(STORAGE_MODE_KEY, newPref);
    } catch (e) {
      console.error(e);
    }
  };

  const isMobile =
    preference === 'mobile'
      ? true
      : preference === 'desktop'
      ? false
      : windowWidth < 768;

  return {
    isMobile,
    preference,
    changePreference,
  };
}
