import { ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        {
          'bg-zinc-900 text-white hover:bg-zinc-700': variant === 'primary',
          'bg-zinc-100 text-zinc-900 hover:bg-zinc-200': variant === 'secondary',
          'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
          'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900': variant === 'ghost',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
