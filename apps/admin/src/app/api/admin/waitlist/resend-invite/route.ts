import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@publisheriq/database';
import { getAuthErrorResponse, requireAdminOrThrow } from '@/lib/auth-utils';
import { buildAuthUrl } from '@/lib/auth/origin';

interface ResendInviteRequest {
  entryId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdminOrThrow();

    const body = (await request.json()) as ResendInviteRequest;
    const entryId = body.entryId?.trim();

    if (!entryId) {
      return NextResponse.json(
        { status: 'validation_error', error: 'entryId is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: entry, error: entryError } = await supabase
      .from('waitlist')
      .select('id, email, status')
      .eq('id', entryId)
      .maybeSingle();

    if (entryError || !entry) {
      return NextResponse.json(
        { status: 'validation_error', error: 'Waitlist entry not found' },
        { status: 404 }
      );
    }

    if (entry.status !== 'approved') {
      return NextResponse.json(
        { status: 'validation_error', error: 'Entry must be approved before sending an invite' },
        { status: 400 }
      );
    }

    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(entry.email, {
      redirectTo: buildAuthUrl(
        '/auth/callback',
        request.nextUrl.origin,
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        'http://localhost:3001'
      ),
    });

    if (inviteError) {
      console.error('Resend invite error:', inviteError);
      return NextResponse.json(
        { status: 'error', error: inviteError.message },
        { status: 500 }
      );
    }

    const inviteSentAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({ invite_sent_at: inviteSentAt })
      .eq('id', entryId);

    if (updateError) {
      console.error('Resend invite timestamp error:', updateError);
    }

    return NextResponse.json({
      status: 'success',
      inviteSentAt,
    });
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    console.error('Resend invite route error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
