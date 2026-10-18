// Thème de l'interface : Auto (réglage du système), Clair ou Sombre. Mémorisé sur l'appareil.
export type Theme = 'auto' | 'light' | 'dark'
export const THEME_LABEL: Record<Theme, string> = { auto: 'Automatique (réglage du téléphone)', light: 'Clair', dark: 'Sombre' }

const KEY = 'permajardin:theme'

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    /* mémorisation impossible : le thème vaut pour cette session */
  }
  applyTheme(theme)
}

export function applyStoredTheme() {
  applyTheme(getTheme())
}
