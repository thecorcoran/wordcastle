import type { Theme } from '../engine/types.js';

export class ThemeProvider {
  constructor(private currentTheme: Theme) {}

  getTheme(): Theme {
    return this.currentTheme;
  }

  setTheme(theme: Theme): void {
    this.currentTheme = theme;
  }
}
