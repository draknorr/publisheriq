import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@publisheriq/database';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@publisheriq/database';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email, waitlistId } = await request.json();

    if (!email || !waitlistId) {
      return NextResponse.json(
        { error: 'Email and waitlistId are required' },
        { status: 400 }
      );
    }

    // Verify the caller is authenticated and is an admin
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
            // Read-only for this check
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Verify the waitlist entry exists and matches the email
    const { data: waitlistEntry, error: waitlistError } = await supabase
      .from('waitlist')
      .select('id, email, status')
      .eq('id', waitlistId)
      .single();

    if (waitlistError || !waitlistEntry) {
      return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 });
    }

    if (waitlistEntry.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email mismatch' }, { status: 400 });
    }

    if (waitlistEntry.status !== 'approved') {
      return NextResponse.json({ error: 'User must be approved first' }, { status: 400 });
    }

    // Send the invite email using service key (admin API)
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin}/auth/callback`,
    });

    if (inviteError) {
      console.error('Failed to send invite:', inviteError);
      return NextResponse.json(
        { error: `Failed to send invite: ${inviteError.message}` },
        { status: 500 }
      );
    }

    // Update invite_sent_at timestamp
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', waitlistId);

    if (updateError) {
      console.error('Failed to update invite_sent_at:', updateError);
      // Don't fail the request - the invite was sent successfully
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send invite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
