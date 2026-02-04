import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
    const appVariant = process.env.APP_VARIANT || 'development';
    const isProd = appVariant === 'production';
    const isPreview = appVariant === 'preview';

    const getBundleId = () => {
        if (isProd) return 'com.doit.app';
        if (isPreview) return 'com.doit.app.preview';
        return 'com.doit.app.dev';
    };

    const getName = () => {
        if (isProd) return 'DoIt';
        if (isPreview) return 'DoIt (Preview)';
        return 'DoIt (Dev)';
    };

    return {
        ...config,
        name: getName(),
        slug: 'doit',
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        scheme: 'doit',
        userInterfaceStyle: 'automatic',
        newArchEnabled: true,
        splash: {
            image: './assets/splash-icon.png',
            resizeMode: 'contain',
            backgroundColor: '#ffffff',
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: getBundleId(),
        },
        android: {
            adaptiveIcon: {
                foregroundImage: './assets/adaptive-icon.png',
                backgroundColor: '#ffffff',
            },
            package: getBundleId(),
        },
        web: {
            bundler: 'metro',
            output: 'static',
            favicon: './assets/favicon.png',
        },
        plugins: ['expo-router', 'expo-secure-store'],
        experiments: {
            typedRoutes: true,
        },
        extra: {
            eas: {
                projectId: 'your-project-id', // Replace with actual project ID if available
            },
            apiUrl: process.env.EXPO_PUBLIC_API_URL,
            appVariant,
        },
    };
};
