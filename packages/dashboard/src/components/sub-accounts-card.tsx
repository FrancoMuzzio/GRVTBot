// H.5: GRVT sub-accounts management card. Renders inside Settings.
// Each row = one entry in `grvt_sub_accounts` (NOT the default
// credentials, which live in `grvt_credentials` and have their own
// onboarding flow). Power users add extras here so different bots
// can route through isolated sub-accounts.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Star } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card } from './primitives/card';
import { Button } from './primitives/button';
import { Input } from './primitives/input';
import { Modal } from './primitives/modal';
import { useConfirm } from './primitives/confirm-dialog';

interface AddState {
  label: string;
  apiKey: string;
  apiSecret: string;
  tradingAddress: string;
  accountId: string;
  subAccountId: string;
  isDefault: boolean;
}

const INITIAL_ADD: AddState = {
  label: '',
  apiKey: '',
  apiSecret: '',
  tradingAddress: '',
  accountId: '',
  subAccountId: '',
  isDefault: false,
};

export function SubAccountsCard() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [addOpen, setAddOpen] = useState(false);
  const [addState, setAddState] = useState<AddState>(INITIAL_ADD);

  const listQuery = useQuery({
    queryKey: ['sub-accounts'],
    queryFn: () => api.listSubAccounts(),
  });

  const createMutation = useMutation({
    mutationFn: (body: AddState) => api.createSubAccount(body),
    onSuccess: () => {
      toast.success('Sub-account added');
      setAddOpen(false);
      setAddState(INITIAL_ADD);
      queryClient.invalidateQueries({ queryKey: ['sub-accounts'] });
    },
    onError: (err: Error) => {
      // The backend returns the precise GRVT failure stage when the
      // login test fails — surface it verbatim.
      toast.error(err.message || 'Failed to add sub-account');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSubAccount(id),
    onSuccess: () => {
      toast.success('Sub-account removed');
      queryClient.invalidateQueries({ queryKey: ['sub-accounts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) =>
      api.updateSubAccount(id, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-accounts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit =
    addState.label.length > 0 &&
    addState.apiKey.length > 0 &&
    /^0x[0-9a-fA-F]{64}$/.test(addState.apiSecret) &&
    /^0x[0-9a-fA-F]{40}$/.test(addState.tradingAddress) &&
    addState.accountId.length > 0 &&
    addState.subAccountId.length > 0 &&
    !createMutation.isPending;

  async function handleDelete(id: number, label: string) {
    const ok = await confirm({
      variant: 'destructive',
      title: `Remove "${label}"?`,
      body: 'Bots using this sub-account must be closed first; otherwise the request will be rejected.',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    deleteMutation.mutate(id);
  }

  const subs = listQuery.data ?? [];

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">GRVT Sub-Accounts</h2>
          <Button
            variant="secondary"
            onClick={() => setAddOpen(true)}
            className="text-xs"
          >
            <Plus className="size-3.5 mr-1 inline" />
            Add
          </Button>
        </div>
        <p className="text-2xs text-text-muted mb-3">
          Connect additional GRVT sub-accounts to run isolated strategies.
          Bots can pick which sub-account to trade against. Same encryption
          as your default credentials (AES-256-GCM).
        </p>

        {listQuery.isLoading ? (
          <p className="text-2xs text-text-muted">Loading…</p>
        ) : subs.length === 0 ? (
          <p className="text-2xs text-text-muted italic">
            No sub-accounts yet. Your bots use your default credentials.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {subs.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">
                    {s.label}
                  </span>
                  {s.isDefault && (
                    <span className="text-2xs text-primary uppercase tracking-wider">
                      Default
                    </span>
                  )}
                  {s.lastTestOk === false && (
                    <span className="text-2xs text-warning">
                      last test failed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!s.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultMutation.mutate(s.id)}
                      disabled={setDefaultMutation.isPending}
                      className="p-1 text-text-muted hover:text-primary transition-colors"
                      aria-label="Set as default"
                      title="Set as default"
                    >
                      <Star className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id, s.label)}
                    disabled={deleteMutation.isPending}
                    className="p-1 text-text-muted hover:text-danger transition-colors"
                    aria-label="Remove"
                    title="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={addOpen}
        onClose={() => {
          if (!createMutation.isPending) {
            setAddOpen(false);
            setAddState(INITIAL_ADD);
          }
        }}
        title="Add GRVT sub-account"
        description="Credentials are tested against GRVT before saving."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setAddOpen(false);
                setAddState(INITIAL_ADD);
              }}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!canSubmit}
              onClick={() => createMutation.mutate(addState)}
            >
              {createMutation.isPending ? 'Testing…' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Label"
            placeholder="e.g. Strategy A"
            value={addState.label}
            onChange={(e) =>
              setAddState({ ...addState, label: e.target.value })
            }
            disabled={createMutation.isPending}
            autoComplete="off"
          />
          <Input
            label="API Key"
            value={addState.apiKey}
            onChange={(e) =>
              setAddState({ ...addState, apiKey: e.target.value })
            }
            disabled={createMutation.isPending}
            autoComplete="off"
          />
          <Input
            label="API Secret (private key, 0x...)"
            type="password"
            value={addState.apiSecret}
            onChange={(e) =>
              setAddState({ ...addState, apiSecret: e.target.value })
            }
            disabled={createMutation.isPending}
            autoComplete="off"
            error={
              addState.apiSecret &&
              !/^0x[0-9a-fA-F]{64}$/.test(addState.apiSecret)
                ? '0x-prefixed 32-byte hex string expected'
                : undefined
            }
          />
          <Input
            label="Trading Address (0x...)"
            value={addState.tradingAddress}
            onChange={(e) =>
              setAddState({ ...addState, tradingAddress: e.target.value })
            }
            disabled={createMutation.isPending}
            autoComplete="off"
            error={
              addState.tradingAddress &&
              !/^0x[0-9a-fA-F]{40}$/.test(addState.tradingAddress)
                ? '0x-prefixed Ethereum address expected'
                : undefined
            }
          />
          <Input
            label="Account ID"
            value={addState.accountId}
            onChange={(e) =>
              setAddState({ ...addState, accountId: e.target.value })
            }
            disabled={createMutation.isPending}
            autoComplete="off"
          />
          <Input
            label="Sub-Account ID"
            value={addState.subAccountId}
            onChange={(e) =>
              setAddState({ ...addState, subAccountId: e.target.value })
            }
            disabled={createMutation.isPending}
            autoComplete="off"
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={addState.isDefault}
              onChange={(e) =>
                setAddState({ ...addState, isDefault: e.target.checked })
              }
              disabled={createMutation.isPending}
            />
            <span>Mark as default sub-account</span>
          </label>
        </div>
      </Modal>
    </>
  );
}
