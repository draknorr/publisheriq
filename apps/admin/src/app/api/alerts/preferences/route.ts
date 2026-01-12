import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';
import { DEFAULT_PREFERENCES, type AlertPreferences } from '@/types/alerts';

export const dynamic = 'force-dynamic';

// GET /api/alerts/preferences - Fetch user's alert preferences
export async function GET() {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('user_alert_preferences')
      .select('*')
      .eq('user_id', result.user.id)
      .single();

    if (error) {
      // If no preferences exist, create with defaults
      if (error.code === 'PGRST116') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newData, error: insertError } = await (supabase as any)
          .from('user_alert_preferences')
          .insert({
            user_id: result.user.id,
            ...DEFAULT_PREFERENCES,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating preferences:', insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json(formatPreferences(newData));
      }

      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(formatPreferences(data));
  } catch (error) {
    console.error('Preferences GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/alerts/preferences - Update user's alert preferences
export async function PUT(request: NextRequest) {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Partial<AlertPreferences> = {};

    // Validate and extract allowed fields
    if (typeof body.alerts_enabled === 'boolean') {
      updates.alerts_enabled = body.alerts_enabled;
    }

    // Validate sensitivity values (0.5 to 2.0)
    const sensitivityFields = ['ccu_sensitivity', 'review_sensitivity', 'sentiment_sensitivity'] as const;
    for (const field of sensitivityFields) {
      if (typeof body[field] === 'number') {
        if (body[field] < 0.5 || body[field] > 2.0) {
          return NextResponse.json(
            { error: `${field} must be between 0.5 and 2.0` },
            { status: 400 }
          );
        }
        updates[field] = body[field];
      }
    }

    // Validate alert type toggles
    const toggleFields = [
      'alert_ccu_spike',
      'alert_ccu_drop',
      'alert_trend_reversal',
      'alert_review_surge',
      'alert_sentiment_shift',
      'alert_price_change',
      'alert_new_release',
      'alert_milestone',
    ] as const;
    for (const field of toggleFields) {
      if (typeof body[field] === 'boolean') {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = await createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('user_alert_preferences')
      .upsert(
        {
          user_id: result.user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating preferences:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(formatPreferences(data));
  } catch (error) {
    console.error('Preferences PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Format database response to match AlertPreferences interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatPreferences(data: any): AlertPreferences {
  return {
    alerts_enabled: data.alerts_enabled,
    ccu_sensitivity: data.ccu_sensitivity,
    review_sensitivity: data.review_sensitivity,
    sentiment_sensitivity: data.sentiment_sensitivity,
    alert_ccu_spike: data.alert_ccu_spike,
    alert_ccu_drop: data.alert_ccu_drop,
    alert_trend_reversal: data.alert_trend_reversal,
    alert_review_surge: data.alert_review_surge,
    alert_sentiment_shift: data.alert_sentiment_shift,
    alert_price_change: data.alert_price_change,
    alert_new_release: data.alert_new_release,
    alert_milestone: data.alert_milestone,
  };
}
