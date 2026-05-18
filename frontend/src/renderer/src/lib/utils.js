import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Conditionally compose Tailwind class strings, deduping conflicts. */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
