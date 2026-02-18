import { NextResponse } from 'next/server';
import { isDbAvailable } from '@/lib/db';
import { generateFeedFromDb } from '@/lib/db-data';
import { generateFeedUnified } from '@/lib/data-source';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  try {
    if (isDbAvailable()) {
      const feed = await generateFeedFromDb(Math.min(limit, 100));
      return NextResponse.json({ feed });
    }

    // File mode fallback
    const feed = await generateFeedUnified();
    return NextResponse.json({ feed });
  } catch (error) {
    console.error('Error loading feed:', error);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
  }
}
