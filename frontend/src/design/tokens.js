// Design tokens and per-module theme hints
// These are JS tokens for now; later can be exported to CSS variables or Tailwind config

const tokens = {
  global: {
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 40,
    },
    radius: {
      sm: 6,
      md: 12,
      lg: 20,
    },
    elevation: {
      low: '0 6px 18px rgba(2,6,23,0.28)',
      mid: '0 20px 60px rgba(2,6,23,0.36)'
    },
    fonts: {
      ui: "Inter, Manrope, 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial",
      display: "Space Grotesk, Manrope, 'Segoe UI', system-ui",
    }
  },

  // Module-specific themes
  dashboard: {
    density: 'spacious',
    palette: {
      bg: 'linear-gradient(180deg,#020617 0%, #071025 100%)',
      accent: '#06b6d4',
      card: 'bg-white/4',
    },
    typography: {
      h1: { size: 28, weight: 700 },
      body: { size: 14, weight: 500 }
    }
  },

  transactions: {
    density: 'compact',
    palette: {
      bg: '#0b1220',
      accent: '#10b981',
      rowHover: 'rgba(255,255,255,0.04)'
    },
    typography: {
      h1: { size: 16, weight: 700 },
      body: { size: 13, weight: 400 }
    }
  },

  aiCharts: {
    density: 'immersive',
    palette: {
      bg: 'linear-gradient(180deg,#020617 0%, #030a1a 100%)',
      accent: '#00c2ff',
      widgetBg: 'rgba(2,6,23,0.6)'
    },
    typography: {
      h1: { size: 30, weight: 800 },
      body: { size: 15, weight: 500 }
    }
  }
};

export default tokens;
