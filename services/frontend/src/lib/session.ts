const TOKEN_KEY = 'superstruct-user.token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const storeToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);
