import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.2297a07e376b409993aae05f50016a0a',
  appName: 'black-invoice-flow',
  webDir: 'dist',
  server: {
    url: 'https://2297a07e-376b-4099-93aa-e05f50016a0a.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
  },
};

export default config;