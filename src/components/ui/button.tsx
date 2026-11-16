import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,background-color,box-shadow,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-ring',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-paper hover:bg-ink/90 shadow-soft',
        accent: 'bg-clay text-white hover:bg-clay-deep shadow-soft',
        secondary: 'bg-sand text-ink hover:bg-line/70',
        outline: 'border border-line bg-card text-ink hover:bg-sand/60',
        ghost: 'text-ink-soft hover:bg-sand/70 hover:text-ink',
        danger: 'bg-[#F7E3DE] text-[#A23B22] hover:bg-[#F2D3CB]',
      },
      size: {
        sm: 'h-9 rounded-full px-3.5 text-[13px]',
        md: 'h-11 rounded-full px-5 text-[15px]',
        lg: 'h-14 rounded-full px-6 text-base',
        icon: 'h-10 w-10 rounded-full',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, block, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
))
Button.displayName = 'Button'
