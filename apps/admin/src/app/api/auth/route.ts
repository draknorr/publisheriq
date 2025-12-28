import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'publisheriq_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const expectedPassword = process.env.AUTH_PASSWORD;

    if (!expectedPassword) {
      console.error('AUTH_PASSWORD environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (password === expectedPassword) {
      const response = NextResponse.json({ success: true });

      response.cookies.set(COOKIE_NAME, 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
