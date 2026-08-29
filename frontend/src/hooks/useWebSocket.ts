import { useState, useEffect, useRef, useCallback } from 'react';
import { WsEvent, SystemMetrics } from '@agcs/shared';
import { ConnectionStatus } from '../types';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
const RECONNECT_INTERVAL = 3000;

export function useWebSocket(onEvent: (event: WsEvent) => void) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const onEventRef = useRef(onEvent);

  // Track the latest handler without tearing down and reopening the socket on
  // every render. Writing the ref during render would be a render side effect.
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    // Guards against a close handler scheduling a reconnect after unmount.
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      setConnectionStatus('connecting');
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        setConnectionStatus('connected');
      };

      socket.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WsEvent;
          onEventRef.current(event);
        } catch {
          // Ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        setConnectionStatus('disconnected');
        reconnectTimer = setTimeout(connect, RECONNECT_INTERVAL);
      };

      socket.onerror = () => {
        if (cancelled) return;
        setConnectionStatus('error');
        socket?.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

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
