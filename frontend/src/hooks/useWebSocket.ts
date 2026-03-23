import { useState, useEffect, useRef, useCallback } from 'react';
import { WsEvent, SystemMetrics } from '@agcs/shared';
import { ConnectionStatus } from '../types';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
const RECONNECT_INTERVAL = 3000;

export function useWebSocket(onEvent: (event: WsEvent) => void) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as WsEvent;
        onEventRef.current(event);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_INTERVAL);
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connectionStatus };
}

export function useSystemMetrics(initialMetrics: SystemMetrics | null = null) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(initialMetrics);

  const handleEvent = useCallback((event: WsEvent) => {
    if (event.type === 'system:metrics') {
      setMetrics(event.payload as SystemMetrics);
    }
  }, []);

  return { metrics, setMetrics, handleEvent };
}
