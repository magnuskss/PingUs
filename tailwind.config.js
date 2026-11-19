/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral blueprint scale — true black to paper white, no tint.
        ink: {
          950: '#050505',
          900: '#0a0a0a',
          850: '#0e0e0e',
          800: '#131313',
          750: '#181818',
          700: '#202020',
          650: '#292929',
          600: '#353535',
          500: '#4c4c4c',
          400: '#7a7a7a',
          300: '#9d9d9d',
          200: '#c1c1c1',
          150: '#d6d6d6',
          100: '#e8e8e8',
          50: '#f5f5f5'
        },
        // Structural accent is white: primary actions, active states, chart lines.
        accent: {
          DEFAULT: '#f2f2f2',
          soft: '#ffffff',
          dim: '#7a7a7a'
        },
        // Signal colours — used only for live status, never decoration.
        good: '#3ee08f',
        warn: '#ffb43d',
        bad: '#ff5a4f'
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Segoe UI Variable Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Mono"', '"Cascadia Code"', 'Consolas', 'ui-monospace', 'monospace']
      },
      fontSize: {
        display: ['3.5rem', { lineHeight: '0.95', letterSpacing: '-0.04em', fontWeight: '500' }],
        hero: ['2.5rem', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '500' }],
        stat: ['1.875rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '500' }],
        label: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.14em', fontWeight: '500' }]
      },
      // Sharp, machined corners everywhere.
      borderRadius: {
        sm: '1px',
        DEFAULT: '2px',
        md: '2px',
        lg: '3px',
        xl: '4px',
        '2xl': '4px',
        card: '3px',
        panel: '2px'
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    }
  },
  plugins: []
}
