import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAdminOrThrow } from '@/lib/auth-utils';
import { createServerClient } from '@/lib/supabase/server';

interface AdjustCreditsRequest {
  userId?: string;
  amount?: number;
  reason?: string;
}

interface AdjustCreditsResult {
  success: boolean;
  new_balance?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdminOrThrow();

    const body = (await request.json()) as AdjustCreditsRequest;
    const userId = body.userId?.trim();
    const reason = body.reason?.trim();
    const amount = body.amount;

    if (!userId || !reason || typeof amount !== 'number' || !Number.isInteger(amount)) {
      return NextResponse.json(
        { status: 'validation_error', error: 'userId, integer amount, and reason are required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('admin_adjust_user_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_description: reason,
    }) as {
      data: AdjustCreditsResult[] | null;
      error: { message: string } | null;
    };

    if (error) {
      return NextResponse.json(
        { status: 'error', error: error.message },
        { status: 500 }
      );
    }

    const result = data?.[0];

    if (!result?.success || typeof result.new_balance !== 'number') {
      return NextResponse.json(
        { status: 'error', error: 'Credit adjustment failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      newBalance: result.new_balance,
    });
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    console.error('Adjust credits error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
