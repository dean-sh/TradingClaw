import { useEffect, useRef, useState, useCallback } from 'react';
import { FeedItem } from '@/lib/api';

type WebSocketMessage = {
    type: 'connected' | 'new_forecast' | 'heartbeat';
    data?: FeedItem;
    message?: string;
    timestamp: string;
};

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.tradingclaw.com/api/v1/protocol/ws/feed';

interface UseWebSocketOptions {
    onNewForecast?: (forecast: FeedItem) => void;
    autoReconnect?: boolean;
    reconnectInterval?: number;
}

interface UseWebSocketReturn {
    status: ConnectionStatus;
    lastMessage: WebSocketMessage | null;
    connect: () => void;
    disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
    const {
        onNewForecast,
        autoReconnect = true,
        reconnectInterval = 5000,
    } = options;

    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isIntentionalClose = useRef(false);

    const connect = useCallback(() => {
        // Clean up existing connection
        if (wsRef.current) {
            isIntentionalClose.current = true;
            wsRef.current.close();
        }

        isIntentionalClose.current = false;
        setStatus('connecting');

        try {
            const ws = new WebSocket(WS_BASE_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                setStatus('connected');
                console.log('[WebSocket] Connected to TradingClaw feed');
            };

            ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    setLastMessage(message);

                    if (message.type === 'new_forecast' && message.data && onNewForecast) {
                        onNewForecast(message.data);
                    }
                } catch (err) {
                    console.error('[WebSocket] Failed to parse message:', err);
                }
            };

            ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
                setStatus('error');
            };

            ws.onclose = (event) => {
                setStatus('disconnected');
                wsRef.current = null;

                if (!isIntentionalClose.current && autoReconnect) {
                    console.log(`[WebSocket] Disconnected. Reconnecting in ${reconnectInterval / 1000}s...`);
                    reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
                }
            };
        } catch (err) {
            console.error('[WebSocket] Failed to connect:', err);
            setStatus('error');

            if (autoReconnect) {
                reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
            }
        }
    }, [onNewForecast, autoReconnect, reconnectInterval]);

    const disconnect = useCallback(() => {
        isIntentionalClose.current = true;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setStatus('disconnected');
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, []);

    return {
        status,
        lastMessage,
        connect,
        disconnect,
    };
}

// Status indicator component helper
export function getStatusColor(status: ConnectionStatus): string {
    switch (status) {
        case 'connected':
            return 'bg-emerald-500';
        case 'connecting':
            return 'bg-amber-500';
        case 'error':
            return 'bg-red-500';
        default:
            return 'bg-zinc-500';
    }
}

export function getStatusText(status: ConnectionStatus): string {
    switch (status) {
        case 'connected':
            return 'Live';
        case 'connecting':
            return 'Connecting...';
        case 'error':
            return 'Error';
        default:
            return 'Offline';
    }
}
