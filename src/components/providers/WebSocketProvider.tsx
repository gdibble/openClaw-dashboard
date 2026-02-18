'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { WsClient, type WsState } from '@/lib/ws-client';
import type { WsEventType } from '@/types';

interface WebSocketContextValue {
  state: WsState;
  client: WsClient | null;
  subscribe: (event: WsEventType, handler: (payload: unknown) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  state: 'disconnected',
  client: null,
  subscribe: () => () => {},
});

export function useWebSocket(): WebSocketContextValue {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<WsClient | null>(null);
  const [state, setState] = useState<WsState>('disconnected');

  useEffect(() => {
    const client = new WsClient();
    clientRef.current = client;

    const unsubState = client.onStateChange(setState);
    client.connect();

    return () => {
      unsubState();
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  const subscribe = (event: WsEventType, handler: (payload: unknown) => void): (() => void) => {
    if (!clientRef.current) return () => {};
    return clientRef.current.on(event, handler);
  };

  return (
    <WebSocketContext.Provider value={{ state, client: clientRef.current, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}
