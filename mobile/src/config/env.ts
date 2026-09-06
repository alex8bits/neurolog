const DEFAULT_API_BASE_URL = 'http://10.0.2.2:8000/api/v1'; // Android-эмулятор → localhost машины

export const API_BASE_URL: string = (
    process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/+$/, ''); // хвостовые «/» из .env не должны давать «…/v1//login»
