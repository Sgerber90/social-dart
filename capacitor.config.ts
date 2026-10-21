import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'za.co.sjgenterprises.socialdart',
  appName: 'Social Dart',
  webDir: 'dist',
  backgroundColor: '#0c0b0a',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0c0b0a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#0c0b0a',
      showSpinner: false,
    },
    StatusBar: { style: 'DARK', overlaysWebView: true },
  },
}

export default config
