import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@publisheriq/database';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = createServiceClient();

    // Check if user already exists via user_profiles (O(1) indexed lookup)
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.error('Profile lookup error:', profileError);
      // Fall through to waitlist check
    } else if (existingProfile) {
      return NextResponse.json({ valid: true });
    }

    // Check if email is on approved waitlist with invite sent
    const { data: waitlistEntry } = await supabase
      .from('waitlist')
      .select('status, invite_sent_at')
      .eq('email', normalizedEmail)
      .single();

    if (waitlistEntry?.status === 'approved') {
      return NextResponse.json({ valid: true });
    }

    // SECURITY NOTE (AUTH-05): This response reveals whether an email exists
    // in the waitlist. Consider using generic responses to prevent enumeration:
    // return NextResponse.json({ valid: false, message: 'Please check your email for further instructions.' });
    // However, this impacts UX significantly. Rate limiting is recommended instead.
    return NextResponse.json({
      valid: false,
      reason: 'not_approved',
      message: 'This email does not have access. Please join the waitlist to request access.',
    });
  } catch (error) {
    console.error('Email validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
