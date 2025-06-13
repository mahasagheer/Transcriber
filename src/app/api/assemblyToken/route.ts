import { AssemblyAI } from 'assemblyai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return new NextResponse('AssemblyAI API key not configured.', { status: 500 });
  }

  const assemblyClient = new AssemblyAI({ apiKey: apiKey });

  const token = await assemblyClient.realtime.createTemporaryToken({
    expires_in: 3_600_000_000,
  });

  const response = {
    token: token,
  };

  return NextResponse.json(response);
}