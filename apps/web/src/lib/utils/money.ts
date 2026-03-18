export function formatMoney(amount: number, currency: string): string {
  const divisor = currency === 'IDR' ? 1 : 100

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount / divisor)
}
