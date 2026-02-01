'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    className?: string;
}

export function AnimatedCounter({
    value,
    duration = 1000,
    decimals = 0,
    prefix = '',
    suffix = '',
    className,
}: AnimatedCounterProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const startValue = useRef(0);
    const startTime = useRef<number | null>(null);

    useEffect(() => {
        startValue.current = displayValue;
        startTime.current = null;

        const animate = (timestamp: number) => {
            if (!startTime.current) {
                startTime.current = timestamp;
            }

            const progress = Math.min((timestamp - startTime.current) / duration, 1);

            // Easing function (ease-out-expo)
            const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            const currentValue = startValue.current + (value - startValue.current) * easeOutExpo;
            setDisplayValue(currentValue);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [value, duration]);

    const formattedValue = displayValue.toFixed(decimals);

    return (
        <span className={cn('tabular-nums', className)}>
            {prefix}
            {formattedValue}
            {suffix}
        </span>
    );
}

interface AnimatedPercentageProps {
    value: number;
    duration?: number;
    className?: string;
}

export function AnimatedPercentage({
    value,
    duration = 1000,
    className,
}: AnimatedPercentageProps) {
    return (
        <AnimatedCounter
            value={value}
            duration={duration}
            decimals={1}
            suffix="%"
            className={className}
        />
    );
}
