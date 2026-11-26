import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getInitialTheme, setTheme, Theme } from '../../lib/theme';
import { Button } from './button';

export const ThemeToggle: React.FC = () => {
  const [theme, setCurrentTheme] = useState<Theme>('dark');

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    setCurrentTheme(initial);
  }, []);

  const handleToggle = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setCurrentTheme(nextTheme);
  };

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleToggle}
      aria-label={label}
      title={label}
      className="h-9 w-9 rounded-xl border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-[0.98]"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-accent transition-transform duration-200" />
      ) : (
        <Moon className="w-4 h-4 text-primary transition-transform duration-200" />
      )}
    </Button>
  );
};
