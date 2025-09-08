import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | any): string {
  // Handle value objects that have a .value property or similar
  let numericValue: number;

  if (typeof value === 'object' && value !== null) {
    // Handle Money objects or similar value objects
    numericValue = value.value || value.getReais?.() || value.getCents?.() / 100 || 0;
  } else {
    numericValue = Number(value) || 0;
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue);
}
