export type ThemeMode = 'light' | 'dark';

export type TokenMap = Record<string, string>;

export type TokenControl = {
  token: string;
  label: string;
  /** `base` = mode-independent; `mode` = edits the active light/dark map. */
  bucket: 'base' | 'mode';
} & (
  | { kind: 'color' }
  | { kind: 'length'; unit: 'px' | 'rem'; min: number; max: number; step: number }
  | { kind: 'choice'; options: { label: string; value: string }[] }
);

export type TokenControlGroup = { label: string; controls: TokenControl[] };

export type ThemeConfig = {
  defaultMode: ThemeMode;
  /** `--wb-ds-*` design tokens, `--wb-public-*` SDK overrides, `--app-*` app-owned tokens */
  base: TokenMap;
  light: TokenMap;
  dark: TokenMap;
  /** Which tokens the Config Studio exposes as live controls. */
  inspector: TokenControlGroup[];
};
