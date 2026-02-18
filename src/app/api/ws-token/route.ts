import { NextResponse } from 'next/server';
import { isAuthEnabled, createWsToken } from '@/lib/auth';

export async function GET() {
  // If auth is not enabled, return a simple flag
  if (!isAuthEnabled()) {
    return NextResponse.json({ token: null, wsUrl: getWsUrl() });
  }

  const token = await createWsToken();
  return NextResponse.json({ token, wsUrl: getWsUrl() });
}

function getWsUrl(): string {
  const port = process.env.PORT || '3000';
  const host = process.env.WS_HOST || `localhost:${port}`;
  const protocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
  return `${protocol}://${host}/ws`;
}
