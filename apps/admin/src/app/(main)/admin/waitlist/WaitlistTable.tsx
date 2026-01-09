'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UnderlineTabs } from '@/components/ui/Tabs';
import { CheckCircle, XCircle, Mail, X, RefreshCw } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface WaitlistEntry {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  how_i_plan_to_use: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  invite_sent_at: string | null;
  created_at: string;
}

interface WaitlistTableProps {
  entries: WaitlistEntry[];
  adminId: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeVariant(status: string): 'default' | 'primary' | 'success' | 'error' {
  switch (status) {
    case 'pending':
      return 'default';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    default:
      return 'default';
  }
}

export function WaitlistTable({ entries, adminId }: WaitlistTableProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [initialCredits, setInitialCredits] = useState('1000');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();

  const filteredEntries = entries.filter((entry) => entry.status === activeTab);

  // Send invite via server-side API route
  const sendInvite = async (email: string, waitlistId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/admin/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, waitlistId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send invite' };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  };

  const handleApprove = async () => {
    if (!selectedEntry) return;

    const credits = parseInt(initialCredits, 10);
    if (isNaN(credits) || credits < 0) {
      setError('Please enter a valid credit amount');
      return;
    }

    setIsApproving(true);
    setError('');

    try {
      const supabase = createBrowserClient();

      // Update waitlist status first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from('waitlist') as any)
        .update({
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedEntry.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Send invite via server-side API
      const inviteResult = await sendInvite(selectedEntry.email, selectedEntry.id);

      if (!inviteResult.success) {
        // Show error but don't block - user is still approved
        setError(`User approved but invite failed: ${inviteResult.error}. You can resend the invite from the Approved tab.`);
        // Still close modal after a delay so user can see the message
        setTimeout(() => {
          setSelectedEntry(null);
          setError('');
          router.refresh();
        }, 3000);
        return;
      }

      setSelectedEntry(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsApproving(false);
    }
  };

  const handleResendInvite = async (entry: WaitlistEntry) => {
    setResendingId(entry.id);
    setError('');
    setSuccessMessage('');

    const result = await sendInvite(entry.email, entry.id);

    if (result.success) {
      setSuccessMessage(`Invite sent to ${entry.email}`);
      router.refresh();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setError(result.error || 'Failed to send invite');
      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    }

    setResendingId(null);
  };

  const handleReject = async (entry: WaitlistEntry) => {
    setIsRejecting(true);

    try {
      const supabase = createBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from('waitlist') as any)
        .update({
          status: 'rejected',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (updateError) {
        console.error('Error rejecting:', updateError);
        return;
      }

      router.refresh();
    } catch (err) {
      console.error('Error rejecting:', err);
    } finally {
      setIsRejecting(false);
    }
  };

  const tabs = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  const showActionsColumn = activeTab === 'pending' || activeTab === 'approved';

  return (
    <>
      {/* Tabs */}
      <div className="p-4 border-b border-border-subtle">
        <UnderlineTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id: string) => {
            setActiveTab(id as typeof activeTab);
            setError('');
            setSuccessMessage('');
          }}
        />
      </div>

      {/* Status Messages */}
      {(error || successMessage) && (
        <div className="px-4 pt-4">
          {error && (
            <div className="p-3 rounded-lg bg-accent-red/10 text-accent-red text-body-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-lg bg-accent-green/10 text-accent-green text-body-sm">
              {successMessage}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-raised">
              <th className="px-4 py-3 text-left text-caption text-text-secondary font-medium">
                Applicant
              </th>
              <th className="px-4 py-3 text-left text-caption text-text-secondary font-medium">
                Use Case
              </th>
              <th className="px-4 py-3 text-left text-caption text-text-secondary font-medium">
                Submitted
              </th>
              <th className="px-4 py-3 text-left text-caption text-text-secondary font-medium">
                Status
              </th>
              {showActionsColumn && (
                <th className="px-4 py-3 text-right text-caption text-text-secondary font-medium">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border-subtle hover:bg-surface-raised transition-colors"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-body-sm text-text-primary font-medium">
                      {entry.full_name}
                    </p>
                    <p className="text-caption text-text-secondary">{entry.email}</p>
                    {entry.organization && (
                      <p className="text-caption text-text-muted">{entry.organization}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-body-sm text-text-secondary max-w-xs truncate">
                    {entry.how_i_plan_to_use || '-'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-body-sm text-text-secondary">
                    {formatDate(entry.created_at)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Badge variant={getStatusBadgeVariant(entry.status)}>
                      {entry.status}
                    </Badge>
                    {entry.status === 'approved' && (
                      <span className="text-caption text-text-muted">
                        {entry.invite_sent_at ? (
                          <>Invite sent {formatDate(entry.invite_sent_at)}</>
                        ) : (
                          <span className="text-accent-orange">Invite not sent</span>
                        )}
                      </span>
                    )}
                  </div>
                </td>
                {activeTab === 'pending' && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1 text-accent-green" />
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(entry)}
                        isLoading={isRejecting}
                      >
                        <XCircle className="h-4 w-4 mr-1 text-accent-red" />
                        Reject
                      </Button>
                    </div>
                  </td>
                )}
                {activeTab === 'approved' && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResendInvite(entry)}
                      isLoading={resendingId === entry.id}
                      disabled={resendingId !== null}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      {entry.invite_sent_at ? 'Resend Invite' : 'Send Invite'}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredEntries.length === 0 && (
        <div className="p-8 text-center text-text-secondary">
          No {activeTab} entries.
        </div>
      )}

      {/* Approve Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <h3 className="text-subheading text-text-primary">Approve Application</h3>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-body-sm text-text-secondary">Applicant</p>
                <p className="text-body text-text-primary">{selectedEntry.full_name}</p>
                <p className="text-caption text-text-muted">{selectedEntry.email}</p>
              </div>

              {selectedEntry.how_i_plan_to_use && (
                <div>
                  <p className="text-body-sm text-text-secondary">Use Case</p>
                  <p className="text-body text-text-primary">{selectedEntry.how_i_plan_to_use}</p>
                </div>
              )}

              <Input
                type="number"
                label="Initial Credits"
                placeholder="Credits to grant on signup"
                value={initialCredits}
                onChange={(e) => setInitialCredits(e.target.value)}
              />

              <p className="text-caption text-text-muted">
                The user will receive an invite email and these credits will be added to their account when they sign up.
              </p>

              {error && (
                <p className="text-body-sm text-accent-red">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-border-subtle">
              <Button
                variant="secondary"
                onClick={() => setSelectedEntry(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleApprove}
                isLoading={isApproving}
              >
                <Mail className="h-4 w-4 mr-2" />
                {isApproving ? 'Sending invite...' : 'Approve & Send Invite'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
