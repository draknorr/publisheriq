'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UnderlineTabs } from '@/components/ui/Tabs';
import { CheckCircle, Filter, Mail, RefreshCw, Search, X, XCircle } from 'lucide-react';
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

function formatReviewer(reviewedBy: string | null): string {
  if (!reviewedBy) return 'Unknown reviewer';
  return `Reviewer ${reviewedBy.slice(0, 8)}`;
}

export function WaitlistTable({ entries }: WaitlistTableProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [initialCredits, setInitialCredits] = useState('1000');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteNotSentOnly, setShowInviteNotSentOnly] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedUseCases, setExpandedUseCases] = useState<Set<string>>(new Set());
  const router = useRouter();

  const filteredEntries = entries.filter((entry) => {
    if (entry.status !== activeTab) {
      return false;
    }

    if (showInviteNotSentOnly && activeTab === 'approved' && entry.invite_sent_at) {
      return false;
    }

    if (!searchQuery.trim()) {
      return true;
    }

    const query = searchQuery.trim().toLowerCase();
    return (
      entry.email.toLowerCase().includes(query)
      || entry.full_name.toLowerCase().includes(query)
      || entry.organization?.toLowerCase().includes(query)
      || entry.how_i_plan_to_use?.toLowerCase().includes(query)
    );
  });

  const dismissMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  const resendInvite = async (waitlistId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/admin/waitlist/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: waitlistId }),
      });

      const data = await response.json() as { status?: string; error?: string };

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send invite' };
      }

      return { success: data.status === 'success', error: data.error };
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
    setSuccessMessage('');

    try {
      const response = await fetch('/api/admin/waitlist/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: selectedEntry.id,
          decision: 'approve',
          initialCredits: credits,
        }),
      });

      const result = await response.json() as {
        status?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? 'Failed to approve entry');
        return;
      }

      if (result.status === 'approved_without_invite') {
        setSuccessMessage(
          `Approved ${selectedEntry.email}, but invite sending failed. Resend it from the Approved tab.`
        );
      } else if (result.status !== 'success') {
        setError(result.error ?? 'Failed to approve entry');
        return;
      } else {
        setSuccessMessage(`Approved ${selectedEntry.email} and sent invite.`);
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

    const result = await resendInvite(entry.id);

    if (result.success) {
      setSuccessMessage(`Invite sent to ${entry.email}`);
      router.refresh();
    } else {
      setError(result.error || 'Failed to send invite');
    }

    setResendingId(null);
  };

  const handleReject = async (entry: WaitlistEntry) => {
    setRejectingId(entry.id);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/admin/waitlist/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: entry.id,
          decision: 'reject',
        }),
      });

      const result = await response.json() as {
        status?: string;
        error?: string;
      };

      if (!response.ok || result.status !== 'success') {
        setError(result.error ?? 'Failed to reject entry');
        return;
      }

      setSuccessMessage(`Rejected ${entry.email}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setRejectingId(null);
    }
  };

  const toggleUseCaseExpanded = (entryId: string) => {
    setExpandedUseCases((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const tabs = [
    { id: 'pending', label: 'Pending', count: entries.filter((entry) => entry.status === 'pending').length },
    { id: 'approved', label: 'Approved', count: entries.filter((entry) => entry.status === 'approved').length },
    { id: 'rejected', label: 'Rejected', count: entries.filter((entry) => entry.status === 'rejected').length },
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
            if (id !== 'approved') {
              setShowInviteNotSentOnly(false);
            }
            dismissMessages();
          }}
        />
      </div>

      <div className="flex flex-col gap-3 p-4 border-b border-border-subtle md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-md">
          <Input
            type="search"
            placeholder="Search by email, name, org, or use case..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        {activeTab === 'approved' ? (
          <Button
            variant={showInviteNotSentOnly ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowInviteNotSentOnly((prev) => !prev)}
          >
            <Filter className="h-4 w-4 mr-1" />
            {showInviteNotSentOnly ? 'Showing Invite Gaps' : 'Invite Not Sent'}
          </Button>
        ) : null}
      </div>

      {/* Status Messages */}
      {(error || successMessage) && (
        <div className="px-4 pt-4">
          {error && (
            <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-accent-red/10 text-accent-red text-body-sm">
              <span>{error}</span>
              <button
                type="button"
                onClick={dismissMessages}
                className="text-accent-red/80 hover:text-accent-red"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {successMessage && (
            <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-accent-green/10 text-accent-green text-body-sm">
              <span>{successMessage}</span>
              <button
                type="button"
                onClick={dismissMessages}
                className="text-accent-green/80 hover:text-accent-green"
                aria-label="Dismiss success"
              >
                <X className="h-4 w-4" />
              </button>
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
                  {entry.how_i_plan_to_use ? (
                    <div className="max-w-xs">
                      <p
                        className={`text-body-sm text-text-secondary ${
                          expandedUseCases.has(entry.id) ? '' : 'line-clamp-2'
                        }`}
                      >
                        {entry.how_i_plan_to_use}
                      </p>
                      {entry.how_i_plan_to_use.length > 90 ? (
                        <button
                          type="button"
                          onClick={() => toggleUseCaseExpanded(entry.id)}
                          className="mt-1 text-caption text-accent-primary hover:text-accent-primary/80"
                        >
                          {expandedUseCases.has(entry.id) ? 'Show less' : 'Show more'}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-body-sm text-text-secondary">-</p>
                  )}
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
                    {(entry.status === 'approved' || entry.status === 'rejected') && entry.reviewed_at && (
                      <span className="text-caption text-text-muted">
                        Reviewed {formatDate(entry.reviewed_at)} by {formatReviewer(entry.reviewed_by)}
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
                        isLoading={rejectingId === entry.id}
                        disabled={rejectingId !== null || isApproving}
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
                      disabled={resendingId !== null || entry.status !== 'approved'}
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
          No {activeTab} entries{searchQuery ? ' matching your search' : ''}.
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
