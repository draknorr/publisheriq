import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserWithProfile, createServerClient } from '@/lib/supabase';
import { Card } from '@/components/ui';
import { Coins, History, LogOut, User } from 'lucide-react';
import { SignOutButton } from './SignOutButton';

export const metadata: Metadata = {
  title: 'Account',
};

export const dynamic = 'force-dynamic';

async function getRecentTransactions(userId: string) {
  const supabase = await createServerClient();

  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  return transactions ?? [];
}

function formatCreditsAsDollars(credits: number): string {
  // 1 credit = $0.01
  return `$${(credits / 100).toFixed(2)}`;
}

function formatTransactionType(type: string): string {
  const typeMap: Record<string, string> = {
    signup_bonus: 'Signup bonus',
    admin_grant: 'Credit added',
    admin_deduct: 'Credit removed',
    chat_usage: 'Chat usage',
    refund: 'Refund',
  };
  return typeMap[type] ?? type;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AccountPage() {
  const result = await getUserWithProfile();

  if (!result) {
    redirect('/login');
  }

  const { profile } = result;
  const transactions = await getRecentTransactions(profile.id);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-display-sm text-text-primary">Account</h1>
        <SignOutButton />
      </div>

      {/* Credit Balance Card */}
      <Card variant="elevated" padding="lg">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-green/15">
            <Coins className="h-6 w-6 text-accent-green" />
          </div>
          <div className="flex-1">
            <p className="text-body-sm text-text-secondary mb-1">Credit Balance</p>
            <div className="flex items-baseline gap-3">
              <p className="text-display-lg text-text-primary">
                {profile.credit_balance.toLocaleString()}
              </p>
              <p className="text-body text-text-tertiary">
                ({formatCreditsAsDollars(profile.credit_balance)})
              </p>
            </div>
            <p className="text-body-xs text-text-muted mt-2">
              Contact your administrator to add credits
            </p>
          </div>
        </div>
      </Card>

      {/* Profile Info Card */}
      <Card variant="default" padding="md">
        <div className="flex items-center gap-3 mb-4">
          <User className="h-5 w-5 text-text-secondary" />
          <h2 className="text-subheading text-text-primary">Profile</h2>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-body-sm text-text-secondary">Email</span>
            <span className="text-body-sm text-text-primary">{profile.email}</span>
          </div>
          {profile.full_name && (
            <div className="flex justify-between">
              <span className="text-body-sm text-text-secondary">Name</span>
              <span className="text-body-sm text-text-primary">{profile.full_name}</span>
            </div>
          )}
          {profile.organization && (
            <div className="flex justify-between">
              <span className="text-body-sm text-text-secondary">Organization</span>
              <span className="text-body-sm text-text-primary">{profile.organization}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-body-sm text-text-secondary">Messages sent</span>
            <span className="text-body-sm text-text-primary">{profile.total_messages_sent}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-body-sm text-text-secondary">Total credits used</span>
            <span className="text-body-sm text-text-primary">{profile.total_credits_used.toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <Card variant="default" padding="md">
          <div className="flex items-center gap-3 mb-4">
            <History className="h-5 w-5 text-text-secondary" />
            <h2 className="text-subheading text-text-primary">Recent Activity</h2>
          </div>
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
              >
                <div>
                  <p className="text-body-sm text-text-primary">
                    {formatTransactionType(tx.transaction_type)}
                  </p>
                  <p className="text-caption text-text-muted">
                    {formatDate(tx.created_at)}
                  </p>
                </div>
                <p
                  className={`text-body-sm font-medium ${
                    tx.amount > 0 ? 'text-accent-green' : 'text-text-secondary'
                  }`}
                >
                  {tx.amount > 0 ? '+' : ''}
                  {tx.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
