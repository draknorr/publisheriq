'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Coins, X } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface UserWithProfile {
  id: string;
  email: string;
  full_name: string | null;
  organization: string | null;
  role: 'user' | 'admin';
  credit_balance: number;
  total_credits_used: number;
  total_messages_sent: number;
  created_at: string;
  updated_at: string;
}

interface UsersTableProps {
  users: UserWithProfile[];
  currentUserId: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.organization?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdjustCredits = async () => {
    if (!selectedUser || !creditAmount || !creditReason) return;

    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount)) {
      setError('Please enter a valid number');
      return;
    }

    setIsAdjusting(true);
    setError('');

    try {
      const supabase = createBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcError } = await (supabase.rpc as any)('admin_adjust_credits', {
        p_admin_id: currentUserId,
        p_user_id: selectedUser.id,
        p_amount: amount,
        p_description: creditReason,
      }) as { data: Array<{ success: boolean; new_balance?: number }> | null; error: Error | null };

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      if (!data?.[0]?.success) {
        setError('Failed to adjust credits');
        return;
      }

      // Close modal and refresh
      setSelectedUser(null);
      setCreditAmount('');
      setCreditReason('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <>
      {/* Search */}
      <div className="p-4 border-b border-border-subtle">
        <Input
          type="text"
          placeholder="Search by email, name, or organization..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-raised">
              <th className="px-4 py-3 text-left text-caption text-text-secondary font-medium">
                User
              </th>
              <th className="px-4 py-3 text-left text-caption text-text-secondary font-medium">
                Role
              </th>
              <th className="px-4 py-3 text-right text-caption text-text-secondary font-medium">
                Credits
              </th>
              <th className="px-4 py-3 text-right text-caption text-text-secondary font-medium">
                Messages
              </th>
              <th className="px-4 py-3 text-left text-caption text-text-secondary font-medium">
                Joined
              </th>
              <th className="px-4 py-3 text-right text-caption text-text-secondary font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border-subtle hover:bg-surface-raised transition-colors"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-body-sm text-text-primary font-medium">
                      {user.full_name || 'No name'}
                    </p>
                    <p className="text-caption text-text-secondary">{user.email}</p>
                    {user.organization && (
                      <p className="text-caption text-text-muted">{user.organization}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.role === 'admin' ? 'primary' : 'default'}>
                    {user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-body-sm text-text-primary font-medium">
                    {user.credit_balance.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-body-sm text-text-secondary">
                    {user.total_messages_sent}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-body-sm text-text-secondary">
                    {formatDate(user.created_at)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(user)}
                  >
                    <Coins className="h-4 w-4 mr-1" />
                    Adjust
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div className="p-8 text-center text-text-secondary">
          No users found matching your search.
        </div>
      )}

      {/* Credit Adjustment Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <h3 className="text-subheading text-text-primary">Adjust Credits</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-body-sm text-text-secondary">User</p>
                <p className="text-body text-text-primary">{selectedUser.email}</p>
              </div>

              <div>
                <p className="text-body-sm text-text-secondary">Current Balance</p>
                <p className="text-display-sm text-text-primary">
                  {selectedUser.credit_balance.toLocaleString()} credits
                </p>
              </div>

              <Input
                type="number"
                label="Amount"
                placeholder="Enter amount (positive to add, negative to remove)"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />

              <Input
                type="text"
                label="Reason"
                placeholder="Reason for adjustment"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
              />

              {error && (
                <p className="text-body-sm text-accent-red">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-border-subtle">
              <Button
                variant="secondary"
                onClick={() => setSelectedUser(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAdjustCredits}
                isLoading={isAdjusting}
                disabled={!creditAmount || !creditReason}
              >
                {isAdjusting ? 'Adjusting...' : 'Adjust Credits'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
