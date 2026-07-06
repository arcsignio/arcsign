export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (num === 0) return "0";

  const truncate = (n: number, decimals: number): string => {
    const factor = Math.pow(10, decimals);
    return (Math.floor(n * factor) / factor).toFixed(decimals);
  };

  if (num < 0.000001) return truncate(num, 10);
  if (num < 0.01) return truncate(num, 8);
  if (num < 1000) return truncate(num, 6);
  return truncate(num, 4);
}
