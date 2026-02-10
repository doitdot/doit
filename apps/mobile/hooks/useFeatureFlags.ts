import { useEffect, useState } from 'react';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

export function useFeatureFlags() {
    const [flags, setFlags] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFlags() {
            try {
                const response = await fetch(`${API_URL}/feature-flags`);
                if (response.ok) {
                    const data = await response.json();
                    setFlags(data);
                }
            } catch (error) {
                console.error('Failed to fetch feature flags:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchFlags();
    }, []);

    const isEnabled = (flag: string) => !!flags[flag];

    return { flags, isEnabled, loading };
}
