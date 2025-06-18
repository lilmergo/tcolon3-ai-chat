'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <button 
      onClick={toggleDarkMode}
      className="relative w-14 h-7 rounded-full bg-secondary/30 flex items-center transition-colors duration-300 ease-in-out border-1 border-secondary/40 focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span 
        className={`absolute left-1 flex items-center justify-center w-5 h-5 rounded-full transform transition-transform duration-300 ease-in-out ${
          darkMode 
            ? 'translate-x-7 bg-primary text-xs' 
            : 'translate-x-0 bg-accent text-xs'
        }`}
      >
        {darkMode ? '🌙' : '☀️'}
      </span>
      <span className="sr-only">{darkMode ? 'Dark mode' : 'Light mode'}</span>
    </button>
  );
}

