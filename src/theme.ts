import { createTheme, MantineColorsTuple } from '@mantine/core';

// Military olive palette — 10 shades from light to dark
const olive: MantineColorsTuple = [
  '#f5f6ed',
  '#e8ebd8',
  '#d4d9b5',
  '#bcc48e',
  '#a5af6b',
  '#8b9a4a',
  '#6e7a3a',
  '#555e2e',
  '#3d4321',
  '#272b15',
];

export const theme = createTheme({
  primaryColor: 'olive',
  colors: { olive },
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: '600',
  },
  defaultRadius: 'md',
  components: {
    Button: {
      defaultProps: { variant: 'filled' },
    },
    Card: {
      defaultProps: { shadow: 'sm', withBorder: true },
    },
  },
});
