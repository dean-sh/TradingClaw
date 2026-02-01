'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle2, AlertCircle, Info, Zap } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
        const id = Math.random().toString(36).substr(2, 9);
        const toast: Toast = { id, message, type, duration };

        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

interface ToastContainerProps {
    toasts: Toast[];
    removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

interface ToastItemProps {
    toast: Toast;
    onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
    const icons = {
        success: CheckCircle2,
        error: AlertCircle,
        info: Info,
        warning: Zap,
    };

    const colors = {
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
        error: 'border-red-500/30 bg-red-500/10 text-red-400',
        info: 'border-cyan-glow/30 bg-cyan-glow/10 text-cyan-glow',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    };

    const Icon = icons[toast.type];

    return (
        <div
            className={cn(
                'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg animate-slide-in-right',
                colors[toast.type]
            )}
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{toast.message}</span>
            <button
                onClick={onClose}
                className="ml-2 p-1 rounded hover:bg-white/10 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

// CSS for animation (add to globals.css)
// @keyframes slide-in-right {
//   from {
//     transform: translateX(100%);
//     opacity: 0;
//   }
//   to {
//     transform: translateX(0);
//     opacity: 1;
//   }
// }
// .animate-slide-in-right {
//   animation: slide-in-right 0.3s ease-out;
// }
