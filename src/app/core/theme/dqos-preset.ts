import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * DQOS // AMT Lab dark theme preset.
 * Maps institutional design tokens onto PrimeUIX Aura base.
 */
export const DqosDarkPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#1a1d24',
          100: '#161920',
          200: '#262B37',
          300: '#323847',
          400: '#4a5060',
          500: '#6b7280',
          600: '#9ca3af',
          700: '#d1d5db',
          800: '#e5e7eb',
          900: '#0D0E12',
          950: '#08090c',
        },
        primary: {
          color: '{primary.400}',
          contrastColor: '#0D0E12',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
        content: {
          background: '#161920',
          hoverBackground: '#1a1d24',
          borderColor: '#262B37',
        },
        formField: {
          background: '#0D0E12',
          borderColor: '#262B37',
          hoverBorderColor: '#323847',
          focusBorderColor: '{primary.color}',
        },
      },
    },
  },
});
