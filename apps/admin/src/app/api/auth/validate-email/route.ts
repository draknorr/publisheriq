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

    // Check if user already exists in auth.users (invited users)
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const userExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (userExists) {
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

    // Not approved
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
