export const compact = (n: number): string =>
  Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const hourLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
