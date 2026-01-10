import { useState, useEffect } from 'react';

export interface ShopperProfile {
    name: string;
    phone: string;
    email: string;
    address: string;
    locationUrl: string;
    notes: string;
}

const STORAGE_KEY = 'shopper_profile';

export const useShopperProfile = () => {
    const [profile, setProfile] = useState<ShopperProfile | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setProfile(JSON.parse(saved));
            } catch (e) {
                console.error('Error parsing shopper profile', e);
            }
        }
    }, []);

    const saveProfile = (newProfile: ShopperProfile) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
        setProfile(newProfile);
    };

    const clearProfile = () => {
        localStorage.removeItem(STORAGE_KEY);
        setProfile(null);
    };

    return {
        profile,
        saveProfile,
        clearProfile
    };
};
