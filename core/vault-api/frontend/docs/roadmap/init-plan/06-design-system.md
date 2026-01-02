# Design System TPB - Multi-Theme White-Label Ready

## Architecture Multi-Theme

```
src/themes/
├── index.ts              # Barrel + getCurrentTheme()
├── types.ts              # ThemeConfig interface
├── default.ts            # TPB dark theme (base)
├── light.ts              # TPB light variant
├── tenant/               # Overrides par tenant (white-label)
│   ├── index.ts          # Registry des themes tenant
│   └── [slug].ts         # Ex: acme.ts, bigcorp.ts
└── applyTheme.ts         # Injecte CSS vars dans :root
```

---

## ThemeConfig Interface

```typescript
// themes/types.ts
export interface ThemeConfig {
  name: string;
  variant: 'dark' | 'light';
  
  colors: {
    // Core
    background: string;
    foreground: string;
    card: string;
    cardHover: string;
    border: string;
    muted: string;
    
    // Brand (personnalisable par tenant)
    accent: string;         // Primary action color
    accentForeground: string;
    brandPrimary: string;   // Logo/brand color
    brandSecondary: string;
    
    // Semantic
    destructive: string;
    success: string;
    warning: string;
    info: string;
  };
  
  fonts?: {
    heading?: string;       // Override possible
    body?: string;
    mono?: string;
  };
  
  // White-label
  branding?: {
    logo?: string;          // URL logo
    logoAlt?: string;       // Alt text
    favicon?: string;
    appName?: string;       // "TPB Vault" ou custom
  };
  
  // Spacing/sizing overrides (optionnel)
  borderRadius?: string;
}
```

---

## Theme TPB Default (Dark)

```typescript
// themes/default.ts
import { ThemeConfig } from './types';

export const defaultTheme: ThemeConfig = {
  name: 'tpb-dark',
  variant: 'dark',
  
  colors: {
    background: '#0A0A0A',
    foreground: '#FAFAFA',
    card: '#171717',
    cardHover: '#1f1f1f',
    border: '#262626',
    muted: '#A3A3A3',
    
    accent: '#FFD700',           // Gold - TPB signature
    accentForeground: '#0A0A0A',
    brandPrimary: '#FFD700',
    brandSecondary: '#0057FF',
    
    destructive: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  
  fonts: {
    heading: "'Space Grotesk', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  
  branding: {
    appName: 'TPB Vault',
  },
  
  borderRadius: '0.5rem',
};
```

---

## Theme Light Variant

```typescript
// themes/light.ts
import { ThemeConfig } from './types';

export const lightTheme: ThemeConfig = {
  name: 'tpb-light',
  variant: 'light',
  
  colors: {
    background: '#FFFFFF',
    foreground: '#0A0A0A',
    card: '#F5F5F5',
    cardHover: '#EBEBEB',
    border: '#E5E5E5',
    muted: '#737373',
    
    accent: '#0057FF',           // Blue for light mode
    accentForeground: '#FFFFFF',
    brandPrimary: '#FFD700',
    brandSecondary: '#0057FF',
    
    destructive: '#DC2626',
    success: '#16A34A',
    warning: '#D97706',
    info: '#2563EB',
  },
};
```

---

## Exemple Theme Tenant (White-Label)

```typescript
// themes/tenant/acme.ts
import { ThemeConfig } from '../types';
import { defaultTheme } from '../default';

export const acmeTheme: ThemeConfig = {
  ...defaultTheme,
  name: 'acme',
  
  colors: {
    ...defaultTheme.colors,
    accent: '#FF5722',           // Orange ACME
    accentForeground: '#FFFFFF',
    brandPrimary: '#FF5722',
    brandSecondary: '#4CAF50',
  },
  
  branding: {
    logo: 'https://cdn.acme.com/logo.svg',
    logoAlt: 'ACME Corp',
    favicon: 'https://cdn.acme.com/favicon.ico',
    appName: 'ACME Access Manager',
  },
};
```

---

## Apply Theme Utility

```typescript
// themes/applyTheme.ts
import { ThemeConfig } from './types';

export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement;
  
  // Colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });
  
  // Fonts
  if (theme.fonts) {
    if (theme.fonts.heading) root.style.setProperty('--font-heading', theme.fonts.heading);
    if (theme.fonts.body) root.style.setProperty('--font-body', theme.fonts.body);
    if (theme.fonts.mono) root.style.setProperty('--font-mono', theme.fonts.mono);
  }
  
  // Border radius
  if (theme.borderRadius) {
    root.style.setProperty('--radius', theme.borderRadius);
  }
  
  // Set variant class for CSS fallbacks
  root.classList.remove('dark', 'light');
  root.classList.add(theme.variant);
}
```

---

## Theme Registry

```typescript
// themes/tenant/index.ts
import { ThemeConfig } from '../types';
import { acmeTheme } from './acme';
// import { bigcorpTheme } from './bigcorp';

export const tenantThemes: Record<string, ThemeConfig> = {
  acme: acmeTheme,
  // bigcorp: bigcorpTheme,
};

export function getTenantTheme(slug: string): ThemeConfig | undefined {
  return tenantThemes[slug];
}
```

---

## Fonts

| Usage | Font | Weight | Override possible |
|-------|------|--------|-------------------|
| Headings | Space Grotesk | 600-700 | Oui via ThemeConfig |
| Body | Inter | 400-600 | Oui via ThemeConfig |
| Code | JetBrains Mono | 400 | Oui via ThemeConfig |

---

## Mapping Composants CSS -> shadcn

| Existant CSS | shadcn/ui |
|--------------|-----------|
| `.btn`, `.btn-primary`, `.btn-accent` | `Button` variants |
| `.card` | `Card` |
| `.badge-*` | `Badge` variants |
| `.modal` | `Dialog` |
| `.code-block`, `.copy-btn` | `CopyBlock` (tpb/) |
| `.form-group`, `.form-hint` | Form components |
| `.spinner` | Spinner component |

---

## globals.css (base)

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Default values - overridden by applyTheme() */
  --background: #0A0A0A;
  --foreground: #FAFAFA;
  --card: #171717;
  --card-hover: #1f1f1f;
  --border: #262626;
  --muted: #A3A3A3;
  --accent: #FFD700;
  --accent-foreground: #0A0A0A;
  --destructive: #EF4444;
  --success: #22C55E;
  --warning: #F59E0B;
  --info: #3B82F6;
  
  --font-heading: 'Space Grotesk', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  --radius: 0.5rem;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-body);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

code, pre {
  font-family: var(--font-mono);
}
```

---

## Integration avec ThemeContext

Le `ThemeContext` (dans `contexts/Theme/`) utilise ces themes :

```typescript
// Charge le theme tenant si disponible, sinon default
const theme = getTenantTheme(org.slug) ?? defaultTheme;
applyTheme(theme);
```
