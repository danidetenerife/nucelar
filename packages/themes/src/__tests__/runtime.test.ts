import { describe, expect, it } from 'vitest';

import {
  applyAdvancedTheme,
  clearAdvancedTheme,
  setBasicTheme,
  setThemeId,
} from '../index';

describe('runtime API', () => {
  it('sets data-theme-id via setThemeId', () => {
    setThemeId('aurora:aurora');
    expect(document.documentElement.getAttribute('data-theme-id')).toBe(
      'aurora:aurora',
    );
  });

  it('sets data-theme-id via setBasicTheme', () => {
    setBasicTheme('aurora:ember');
    expect(document.documentElement.getAttribute('data-theme-id')).toBe(
      'aurora:ember',
    );
  });

  it('injects and clears advanced theme style', () => {
    applyAdvancedTheme({ version: 1, name: 'X', vars: { radius: '10px' } });
    const style = document.getElementById('advanced-theme');
    expect(style).toBeTruthy();
    expect(style?.textContent).toMatchInlineSnapshot(`
":root{--radius: 10px;}"`);

    clearAdvancedTheme();
    expect(document.getElementById('advanced-theme')).toBeNull();
  });
});
