import React from 'react';
import logo from '@/assets/cobro-logo.png';

interface LoadingLogoProps {
    text?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string; // Add className prop for flexibility
}

export const LoadingLogo: React.FC<LoadingLogoProps> = ({
    text = 'Cargando...',
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'w-16 h-16', // Slightly larger to accommodate logo details
        md: 'w-32 h-32',
        lg: 'w-48 h-48',
    };

    return (
        <div className={`flex flex-col items-center justify-center min-h-[50vh] p-4 ${className}`}>
            <div className={`relative flex items-center justify-center ${sizeClasses[size]} mb-6`}>
                {/* Outer Glow/Pulse */}
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />

                {/* Rotating ring effect around logo (optional, matches the "spinner" feel but branded) */}
                <div className="absolute -inset-4 border-4 border-primary/20 border-t-primary rounded-full animate-spin selection:bg-transparent" />

                {/* Logo with breathable pulse */}
                <img
                    src={logo}
                    alt="Loading..."
                    loading="eager"
                    className="relative z-10 w-full h-full object-contain p-2 animate-[pulse_3s_ease-in-out_infinite]"
                />
            </div>
            {text && (
                <div className="flex flex-col items-center gap-2">
                    <h3 className="text-xl font-semibold text-primary animate-pulse tracking-wide">
                        {text}
                    </h3>
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_infinite_0ms]" />
                        <div className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_infinite_200ms]" />
                        <div className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_infinite_400ms]" />
                    </div>
                </div>
            )}
        </div>
    );
};
