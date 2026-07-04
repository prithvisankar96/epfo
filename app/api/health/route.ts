import { NextResponse } from 'next/server';
import { getProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

// GET /api/health → { app: "ok", provider: ProviderHealth }

export async function GET() {
  try {
    const provider = getProvider();
    const health = await provider.healthCheck();
    return NextResponse.json({ app: 'ok', provider: health });
  } catch {
    return NextResponse.json(
      {
        app: 'ok',
        provider: {
          provider: process.env.PF_PROVIDER ?? 'mock',
          ok: false,
          checkedAt: new Date().toISOString(),
          detail: 'health check failed',
        },
      },
      { status: 200 }
    );
  }
}
