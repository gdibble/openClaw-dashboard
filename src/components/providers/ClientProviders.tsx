'use client';

import { WebSocketProvider } from './WebSocketProvider';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider>
      {children}
    </WebSocketProvider>
  );
}
