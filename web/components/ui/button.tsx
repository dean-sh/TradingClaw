import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                primary: 'bg-white text-black hover:bg-gray-200',
                secondary: 'bg-zinc-800 text-white hover:bg-zinc-700',
                ghost: 'bg-transparent text-white hover:bg-white/10',
                neon: 'bg-transparent border border-cyan-glow text-cyan-glow hover:bg-cyan-glow/10 neon-border-cyan',
                neonPurple: 'bg-transparent border border-purple-glow text-purple-glow hover:bg-purple-glow/10 neon-border-purple',
                outline: 'border border-white/10 bg-transparent text-white hover:bg-white/5 hover:border-white/20',
                destructive: 'bg-red-600 text-white hover:bg-red-700',
                link: 'text-cyan-glow underline-offset-4 hover:underline',
            },
            size: {
                sm: 'px-3 py-1.5 text-sm',
                md: 'px-5 py-2.5',
                lg: 'px-8 py-4 text-lg',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
