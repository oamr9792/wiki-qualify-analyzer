import React from 'react';
import { reputationCitadelTheme } from '@/lib/themes';

type ThemeProviderProps = {
  children: React.ReactNode;
  theme: 'reputationCitadel' | 'default';
};

export function ThemeProvider({ children, theme = 'reputationCitadel' }: ThemeProviderProps) {
  // Apply theme variables to the :root element
  React.useEffect(() => {
    const root = document.documentElement;
    const themeColors = theme === 'reputationCitadel' ? reputationCitadelTheme : {};
    
    // Apply theme CSS variables directly
    Object.entries(themeColors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value as string);
    });
    
    return () => {
      // Cleanup if needed
    };
  }, [theme]);
  
  return <div className="font-sans">{children}</div>;
} 