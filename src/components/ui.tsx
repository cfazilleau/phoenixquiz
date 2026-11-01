import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-phoenix to-phoenix-2 text-ink hover:brightness-110',
  secondary: 'bg-panel-2 text-white border border-line hover:bg-line',
  ghost: 'text-muted hover:text-white hover:bg-panel-2',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'px-2.5 py-1 text-sm',
        size === 'md' && 'px-4 py-2',
        size === 'lg' && 'px-6 py-3 text-lg',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-line bg-panel/90 p-5 shadow-xl', className)}>{children}</div>;
}

const field =
  'w-full rounded-lg border border-line bg-ink/70 px-3 py-2 text-white placeholder:text-muted/60 focus:border-phoenix focus:outline-none';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, className)} {...props} />;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cn('mb-1 block text-sm font-medium text-muted', className)}>{children}</label>;
}

export function Avatar({ src, alt, size = 40, className }: { src: string; alt: string; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('shrink-0 rounded-full bg-panel-2 object-cover', className)}
      style={{ width: size, height: size }}
    />
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full bg-panel-2 px-2.5 py-0.5 text-xs font-semibold', className)}>
      {children}
    </span>
  );
}
