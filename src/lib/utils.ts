import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Background classes for answer options, Kahoot-style. */
export const OPTION_COLORS = [
  'bg-opt-1',
  'bg-opt-2',
  'bg-opt-3',
  'bg-opt-4',
  'bg-opt-5',
  'bg-opt-6',
  'bg-opt-7',
  'bg-opt-8',
];
export const OPTION_SHAPES = ['▲', '◆', '●', '■', '★', '⬟', '⬢', '✚'];
