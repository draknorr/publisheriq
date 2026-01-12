import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_PIN_SETTINGS,
  type PinAlertSettings,
  type PinAlertSettingsResponse,
  type AlertPreferences,
  type InheritablePreferenceKey,
} from '@/types/alerts';

export const dynamic = 'force-dynamic';

// Note: user_pin_alert_settings table is created by migration 20260113000001_add_pin_alert_settings.sql
// Types will be available after running: pnpm --filter database generate

// GET /api/pins/[id]/alert-settings - Fetch pin's alert settings with inheritance info
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pinId } = await params;
    const supabase = await createServerClient();

    // Verify user owns this pin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pin, error: pinError } = await (supabase as any)
      .from('user_pins')
      .select('id')
      .eq('id', pinId)
      .eq('user_id', result.user.id)
      .single();

    if (pinError || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    // Fetch pin-specific settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pinSettings } = await (supabase as any)
      .from('user_pin_alert_settings')
      .select('*')
      .eq('pin_id', pinId)
      .single();

    // Fetch global preferences for computing effective values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: globalPrefs } = await (supabase as any)
      .from('user_alert_preferences')
      .select('*')
      .eq('user_id', result.user.id)
      .single();

    const global = globalPrefs || DEFAULT_PREFERENCES;
    const settings = pinSettings ? formatPinSettings(pinSettings) : null;

    // Compute inherited flags and effective values
    const response = computeSettingsResponse(settings, global);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Pin alert settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/pins/[id]/alert-settings - Create or update pin's alert settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pinId } = await params;
    const body = await request.json();
    const supabase = await createServerClient();

    // Verify user owns this pin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pin, error: pinError } = await (supabase as any)
      .from('user_pins')
      .select('id')
      .eq('id', pinId)
      .eq('user_id', result.user.id)
      .single();

    if (pinError || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    // Build updates object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      pin_id: pinId,
      updated_at: new Date().toISOString(),
    };

    // Handle use_custom_settings toggle
    if (typeof body.use_custom_settings === 'boolean') {
      updates.use_custom_settings = body.use_custom_settings;
    }

    // Handle per-pin alerts_enabled
    if (typeof body.alerts_enabled === 'boolean') {
      updates.alerts_enabled = body.alerts_enabled;
    }

    // Validate and extract sensitivity values (0.5 to 2.0, or null to inherit)
    const sensitivityFields = ['ccu_sensitivity', 'review_sensitivity', 'sentiment_sensitivity'] as const;
    for (const field of sensitivityFields) {
      if (body[field] === null) {
        updates[field] = null; // Inherit from global
      } else if (typeof body[field] === 'number') {
        if (body[field] < 0.5 || body[field] > 2.0) {
          return NextResponse.json(
            { error: `${field} must be between 0.5 and 2.0` },
            { status: 400 }
          );
        }
        updates[field] = body[field];
      }
    }

    // Validate alert type toggles (boolean or null to inherit)
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
      if (body[field] === null) {
        updates[field] = null; // Inherit from global
      } else if (typeof body[field] === 'boolean') {
        updates[field] = body[field];
      }
    }

    // Upsert pin settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pinSettings, error: upsertError } = await (supabase as any)
      .from('user_pin_alert_settings')
      .upsert(updates, { onConflict: 'pin_id' })
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting pin settings:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Fetch global preferences for computing effective values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: globalPrefs } = await (supabase as any)
      .from('user_alert_preferences')
      .select('*')
      .eq('user_id', result.user.id)
      .single();

    const global = globalPrefs || DEFAULT_PREFERENCES;
    const settings = formatPinSettings(pinSettings);

    const response = computeSettingsResponse(settings, global);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Pin alert settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/pins/[id]/alert-settings - Remove pin's custom settings (revert to global)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pinId } = await params;
    const supabase = await createServerClient();

    // Verify user owns this pin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pin, error: pinError } = await (supabase as any)
      .from('user_pins')
      .select('id')
      .eq('id', pinId)
      .eq('user_id', result.user.id)
      .single();

    if (pinError || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    // Delete pin settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('user_pin_alert_settings')
      .delete()
      .eq('pin_id', pinId);

    if (deleteError) {
      console.error('Error deleting pin settings:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pin alert settings DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Format database response to match PinAlertSettings interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatPinSettings(data: any): PinAlertSettings {
  return {
    use_custom_settings: data.use_custom_settings,
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

// Compute effective values and inheritance flags
function computeSettingsResponse(
  pinSettings: PinAlertSettings | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalPrefs: any
): PinAlertSettingsResponse {
  const useCustom = pinSettings?.use_custom_settings ?? false;

  // All inheritable keys (excludes alerts_enabled which has special logic)
  const inheritableKeys: InheritablePreferenceKey[] = [
    'ccu_sensitivity',
    'review_sensitivity',
    'sentiment_sensitivity',
    'alert_ccu_spike',
    'alert_ccu_drop',
    'alert_trend_reversal',
    'alert_review_surge',
    'alert_sentiment_shift',
    'alert_price_change',
    'alert_new_release',
    'alert_milestone',
  ];

  // Compute inherited flags
  const inherited: Record<InheritablePreferenceKey, boolean> = {} as Record<InheritablePreferenceKey, boolean>;
  for (const key of inheritableKeys) {
    // Inherited if: no custom settings, or custom enabled but value is null
    inherited[key] = !useCustom || pinSettings?.[key] === null || pinSettings?.[key] === undefined;
  }

  // Compute effective values
  const effective: AlertPreferences = {
    alerts_enabled: useCustom
      ? (pinSettings?.alerts_enabled ?? true)
      : true,
    ccu_sensitivity: inherited.ccu_sensitivity
      ? (globalPrefs?.ccu_sensitivity ?? DEFAULT_PREFERENCES.ccu_sensitivity)
      : (pinSettings?.ccu_sensitivity ?? DEFAULT_PREFERENCES.ccu_sensitivity),
    review_sensitivity: inherited.review_sensitivity
      ? (globalPrefs?.review_sensitivity ?? DEFAULT_PREFERENCES.review_sensitivity)
      : (pinSettings?.review_sensitivity ?? DEFAULT_PREFERENCES.review_sensitivity),
    sentiment_sensitivity: inherited.sentiment_sensitivity
      ? (globalPrefs?.sentiment_sensitivity ?? DEFAULT_PREFERENCES.sentiment_sensitivity)
      : (pinSettings?.sentiment_sensitivity ?? DEFAULT_PREFERENCES.sentiment_sensitivity),
    alert_ccu_spike: inherited.alert_ccu_spike
      ? (globalPrefs?.alert_ccu_spike ?? DEFAULT_PREFERENCES.alert_ccu_spike)
      : (pinSettings?.alert_ccu_spike ?? DEFAULT_PREFERENCES.alert_ccu_spike),
    alert_ccu_drop: inherited.alert_ccu_drop
      ? (globalPrefs?.alert_ccu_drop ?? DEFAULT_PREFERENCES.alert_ccu_drop)
      : (pinSettings?.alert_ccu_drop ?? DEFAULT_PREFERENCES.alert_ccu_drop),
    alert_trend_reversal: inherited.alert_trend_reversal
      ? (globalPrefs?.alert_trend_reversal ?? DEFAULT_PREFERENCES.alert_trend_reversal)
      : (pinSettings?.alert_trend_reversal ?? DEFAULT_PREFERENCES.alert_trend_reversal),
    alert_review_surge: inherited.alert_review_surge
      ? (globalPrefs?.alert_review_surge ?? DEFAULT_PREFERENCES.alert_review_surge)
      : (pinSettings?.alert_review_surge ?? DEFAULT_PREFERENCES.alert_review_surge),
    alert_sentiment_shift: inherited.alert_sentiment_shift
      ? (globalPrefs?.alert_sentiment_shift ?? DEFAULT_PREFERENCES.alert_sentiment_shift)
      : (pinSettings?.alert_sentiment_shift ?? DEFAULT_PREFERENCES.alert_sentiment_shift),
    alert_price_change: inherited.alert_price_change
      ? (globalPrefs?.alert_price_change ?? DEFAULT_PREFERENCES.alert_price_change)
      : (pinSettings?.alert_price_change ?? DEFAULT_PREFERENCES.alert_price_change),
    alert_new_release: inherited.alert_new_release
      ? (globalPrefs?.alert_new_release ?? DEFAULT_PREFERENCES.alert_new_release)
      : (pinSettings?.alert_new_release ?? DEFAULT_PREFERENCES.alert_new_release),
    alert_milestone: inherited.alert_milestone
      ? (globalPrefs?.alert_milestone ?? DEFAULT_PREFERENCES.alert_milestone)
      : (pinSettings?.alert_milestone ?? DEFAULT_PREFERENCES.alert_milestone),
  };

  return {
    settings: pinSettings ?? DEFAULT_PIN_SETTINGS,
    inherited,
    effective,
  };
}
