import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isDevLoginEnabled } from '@/lib/dev-auth';

/**
 * Dev login endpoint - generates a magic link without sending email.
 * Secured by layered environment checks in dev-auth.ts.
 *
 * Usage:
 * POST /api/auth/dev-login
 * Body: { "email": "user@example.com" }
 *
 * Returns: { "success": true, "callback_url": "/auth/callback?token_hash=xxx&type=magiclink" }
 */
export async function POST(request: Request) {
  // Get hostname from request for security check
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Security check (layered - env var + environment + domain)
  if (!isDevLoginEnabled(hostname)) {
    return NextResponse.json(
      { error: 'Dev login not available in this environment' },
      { status: 403 }
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  console.warn(`[DEV AUTH] ⚠️ Dev login requested for: ${email}`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[DEV AUTH] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  // Use admin client to generate session
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Generate magic link (without sending email)
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error) {
    console.error('[DEV AUTH] Failed to generate link:', error.message);
    return NextResponse.json(
      { error: 'Failed to generate session', details: error.message },
      { status: 500 }
    );
  }

  // Extract the hashed token from the response
  // Supabase admin.generateLink returns action_link and hashed_token
  const actionLink = data.properties?.action_link;
  const hashedToken = data.properties?.hashed_token;

  if (!actionLink && !hashedToken) {
    console.error('[DEV AUTH] No action_link or hashed_token in response');
    return NextResponse.json(
      { error: 'No token generated' },
      { status: 500 }
    );
  }

  // Use hashed_token if available, otherwise parse from action_link
  let token: string | undefined | null = hashedToken;
  if (!token && actionLink) {
    const parsedUrl = new URL(actionLink);
    token = parsedUrl.searchParams.get('token');
  }

  if (!token) {
    console.error('[DEV AUTH] Could not extract token');
    return NextResponse.json(
      { error: 'Could not extract token' },
      { status: 500 }
    );
  }

  console.warn(`[DEV AUTH] ⚠️ Dev login link generated for: ${email}`);

  return NextResponse.json({
    success: true,
    // Client should redirect here to complete login
    callback_url: `/auth/callback?token_hash=${token}&type=magiclink`,
  });
}
