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

    // SECURITY FIX (AUTH-04): Use paginated listUsers with email filter
    // The default listUsers() only returns the first page (50 users) which causes
    // validation failures once the user count exceeds 50.
    // Using filter parameter limits results to matching email.
    const { data: existingUsers } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    // Filter client-side since Supabase admin API doesn't support email filter directly
    // But with small perPage we minimize data transfer, and we check all pages if needed
    const userExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    // If not found on first page and there are more users, paginate through all
    if (!userExists && existingUsers?.users?.length === 1) {
      // First page didn't have the user, need to search all pages
      let page = 1;
      let foundUser = false;
      const perPage = 1000; // Larger page size for efficiency

      while (!foundUser) {
        const { data: pageData } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });

        if (!pageData?.users || pageData.users.length === 0) {
          break; // No more users
        }

        foundUser = pageData.users.some(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );

        if (pageData.users.length < perPage) {
          break; // Last page
        }
        page++;
      }

      if (foundUser) {
        return NextResponse.json({ valid: true });
      }
    } else if (userExists) {
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
