/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Carrier colors - professional and readable
                ups: {
                    DEFAULT: '#3B82F6',
                    light: '#60A5FA',
                    dark: '#2563EB',
                },
                fedex: {
                    DEFAULT: '#10B981',
                    light: '#34D399',
                    dark: '#059669',
                },
                dhl: {
                    DEFAULT: '#F97316',
                    light: '#FB923C',
                    dark: '#EA580C',
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
}

