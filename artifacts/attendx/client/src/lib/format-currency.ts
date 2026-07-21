export type Currency = "USD" | "EUR" | "SEK";

export interface CurrencyOption {
  code: Currency;
  symbol: string;
  labelAr: string;
  labelEn: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$",    labelAr: "دولار أمريكي",     labelEn: "US Dollar" },
  { code: "EUR", symbol: "€",    labelAr: "يورو",             labelEn: "Euro" },
  { code: "SEK", symbol: "kr",   labelAr: "كرون سويدي",       labelEn: "Swedish Krona" },
];

export function getCurrencySymbol(code: Currency): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code;
}

export function formatCurrency(amount: number, currency: Currency = "USD"): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${symbol}`;
}
