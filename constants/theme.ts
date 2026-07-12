/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const THEME = {
  navy900: '#000046',
  navy800: '#001F3F',
  gold500: '#D5AD36',
  gold400: '#FFD700',
  gold600: '#AA8A2E',
  surface: '#1A1A2E',
  white: '#FFFFFF',
  gray: '#F3F4F6',
  placeholder: '#9CA3AF',
};

export const Colors = {
  light: {
    text: '#000046',
    background: '#FFFFFF',
    tint: '#D5AD36',
    icon: '#001F3F',
    tabIconDefault: '#687076',
    tabIconSelected: '#D5AD36',
  },
  dark: {
    text: '#FFFFFF',
    background: '#1A1A2E',
    tint: '#D5AD36',
    icon: '#D5AD36',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#D5AD36',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
