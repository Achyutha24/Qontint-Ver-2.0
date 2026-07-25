/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-deep':    'var(--bg-void)',
        'bg-surface': 'var(--bg-surface)',
        'bg-card':    'var(--bg-card)',
        'bg-raised':  'var(--surface-raised)',
        'accent':     'var(--aurora)',
        'teal':       'var(--plasma)',
        'amber':      'var(--stellar)',
        'blue':       'var(--aurora)',
        'text-pri':   'var(--text-primary)',
        'text-sec':   'var(--text-secondary)',
        'text-dim':   'var(--text-muted)',
        // Legacy compat mappings — all remapped to light orange palette
        'cyan':       'var(--plasma)',
        'gold':       'var(--stellar)',
        'purple':     'var(--aurora)',
        'pink':       'var(--aurora)',
        'green':      'var(--plasma)',
        'red':        'var(--solar)',
        'primary-dark':   'var(--bg-void)',
        'gen-teal':       'var(--plasma)',
        'intel-blue':     'var(--aurora)',
        'authority-gold': 'var(--stellar)',
        'novelty-purple': 'var(--aurora)',
        'alert-red':      'var(--danger)',
        'text-primary':   'var(--text-primary)',
        'text-muted':     'var(--text-muted)',
        'graph-accent':   'var(--aurora)',
      },
      fontFamily: {
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Space Grotesk"', 'sans-serif'],
        body:    ['"Inter"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        sans:    ['"Inter"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float':       'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        }
      },
    },
  },
  plugins: [],
};
