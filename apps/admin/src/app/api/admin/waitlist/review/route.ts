import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@publisheriq/database';
import { getAuthErrorResponse, requireAdminOrThrow } from '@/lib/auth-utils';
import { buildAuthUrl } from '@/lib/auth/origin';

type ReviewDecision = 'approve' | 'reject';

interface ReviewWaitlistRequest {
  entryId?: string;
  decision?: ReviewDecision;
  initialCredits?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user } = await requireAdminOrThrow();
    const body = (await request.json()) as ReviewWaitlistRequest;
    const entryId = body.entryId?.trim();
    const decision = body.decision;

    if (!entryId || (decision !== 'approve' && decision !== 'reject')) {
      return NextResponse.json(
        { status: 'validation_error', error: 'entryId and decision are required' },
        { status: 400 }
      );
    }

    if (
      decision === 'approve'
      && (typeof body.initialCredits !== 'number'
        || !Number.isInteger(body.initialCredits)
        || body.initialCredits < 0)
    ) {
      return NextResponse.json(
        { status: 'validation_error', error: 'initialCredits must be a non-negative integer' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const reviewedAt = new Date().toISOString();

    const { data: entry, error: entryError } = await supabase
      .from('waitlist')
      .select('id, email, status, invite_sent_at')
      .eq('id', entryId)
      .maybeSingle();

    if (entryError || !entry) {
      return NextResponse.json(
        { status: 'validation_error', error: 'Waitlist entry not found' },
        { status: 404 }
      );
    }

    if (entry.status !== 'pending') {
      return NextResponse.json(
        {
          status: 'already_reviewed',
          error: `Entry is already ${entry.status}`,
          currentStatus: entry.status,
          inviteSentAt: entry.invite_sent_at,
        },
        { status: 409 }
      );
    }

    if (decision === 'reject') {
      const { error: rejectError } = await supabase
        .from('waitlist')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: reviewedAt,
        })
        .eq('id', entryId)
        .eq('status', 'pending');

      if (rejectError) {
        return NextResponse.json(
          { status: 'error', error: rejectError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: 'success',
        reviewedAt,
        decision,
      });
    }

    const initialCredits = body.initialCredits ?? 1000;
    const { error: approveError } = await supabase
      .from('waitlist')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
        initial_credits: initialCredits,
      })
      .eq('id', entryId)
      .eq('status', 'pending');

    if (approveError) {
      return NextResponse.json(
        { status: 'error', error: approveError.message },
        { status: 500 }
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
      console.error('Waitlist review invite error:', inviteError);
      return NextResponse.json({
        status: 'approved_without_invite',
        error: inviteError.message,
        reviewedAt,
        initialCredits,
      });
    }

    const inviteSentAt = new Date().toISOString();
    const { error: inviteTimestampError } = await supabase
      .from('waitlist')
      .update({ invite_sent_at: inviteSentAt })
      .eq('id', entryId);

    if (inviteTimestampError) {
      console.error('Waitlist review invite timestamp error:', inviteTimestampError);
    }

    return NextResponse.json({
      status: 'success',
      reviewedAt,
      inviteSentAt,
      initialCredits,
    });
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    console.error('Waitlist review error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
