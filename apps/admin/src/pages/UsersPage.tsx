import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { fadeUp, stagger } from '@bmw/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Modal, ReasonDialog } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { apiSend, ApiError } from '../lib/api';
import { usePagedList, errorMessage } from '../lib/hooks';
import { STATUS_OPTIONS, formatDate } from '../lib/format';
import type { UserDTO } from '../lib/types';

type ModerationAction = 'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE';

interface PendingModeration {
  user: UserDTO;
  action: ModerationAction;
}

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'PARTNER' | 'ADMIN';
  phone: string;
}

const EMPTY_FORM: CreateForm = { name: '', email: '', password: '', role: 'CUSTOMER', phone: '' };

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const q = params.get('q') ?? '';
  const role = params.get('role') ?? '';
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '20') || 20;

  const [searchDraft, setSearchDraft] = useState(q);
  const { items, pagination, loading, error, reload } = usePagedList<UserDTO>('/admin/users', {
    q: q || undefined,
    role: role || undefined,
    status: status || undefined,
    page,
    limit,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  // ---- create customer modal ----
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const validateCreate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2 || form.name.trim().length > 80) errs.name = 'Name must be 2–80 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (form.password.length < 8 || form.password.length > 72) errs.password = 'Password must be 8–72 characters.';
    if (form.phone.trim().length > 20) errs.phone = 'Phone must be under 20 characters.';
    return errs;
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateCreate();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setCreating(true);
    try {
      await apiSend('POST', '/admin/users', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        phone: form.phone.trim() || null,
      });
      toast.success(`${form.role.toLowerCase()} account created.`);
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      if (err instanceof ApiError) setFormErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // ---- moderation ----
  const [pending, setPending] = useState<PendingModeration | null>(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const runModeration = async (reason: string) => {
    if (!pending) return;
    setModerationBusy(true);
    setServerError(null);
    try {
      await apiSend('PATCH', `/admin/users/${pending.user.id}`, {
        action: pending.action,
        reason: reason || null,
      });
      const pastTense: Record<ModerationAction, string> = {
        SUSPEND: 'suspended',
        REACTIVATE: 'reactivated',
        DEACTIVATE: 'deactivated',
      };
      toast.success(`${pending.user.name} ${pastTense[pending.action]}.`);
      setPending(null);
      reload();
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setModerationBusy(false);
    }
  };

  const columns = useMemo<Column<UserDTO>[]>(
    () => [
      {
        key: 'user',
        header: 'User',
        render: (u) => (
          <div className="cell-stack">
            <strong>{u.name}</strong>
            <span className="muted">{u.email}</span>
          </div>
        ),
      },
      { key: 'role', header: 'Role', render: (u) => <StatusBadge status={u.role} tone={u.role === 'ADMIN' ? 'danger' : u.role === 'PARTNER' ? 'accent' : 'info'} /> },
      { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} group="account" /> },
      { key: 'phone', header: 'Phone', secondary: true, render: (u) => u.phone ?? '—' },
      { key: 'verified', header: 'Email verified', secondary: true, render: (u) => (u.emailVerified ? 'Yes' : 'No') },
      { key: 'created', header: 'Joined', secondary: true, render: (u) => formatDate(u.createdAt) },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (u) => {
          if (u.role === 'ADMIN') return <span className="muted">—</span>;
          const buttons = [];
          if (u.status !== 'SUSPENDED') {
            buttons.push(
              <button
                key="suspend"
                type="button"
                className="btn btn--danger-ghost btn--sm"
                onClick={() => {
                  setServerError(null);
                  setPending({ user: u, action: 'SUSPEND' });
                }}
              >
                Suspend
              </button>,
            );
          }
          if (u.status !== 'ACTIVE') {
            buttons.push(
              <button
                key="reactivate"
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setServerError(null);
                  setPending({ user: u, action: 'REACTIVATE' });
                }}
              >
                Reactivate
              </button>,
            );
          }
          if (u.status !== 'DEACTIVATED') {
            buttons.push(
              <button
                key="deactivate"
                type="button"
                className="btn btn--danger-ghost btn--sm"
                onClick={() => {
                  setServerError(null);
                  setPending({ user: u, action: 'DEACTIVATE' });
                }}
              >
                Deactivate
              </button>,
            );
          }
          return <div className="cell-actions">{buttons}</div>;
        },
      },
    ],
    [],
  );

  return (
    <>
      <motion.header variants={fadeUp} initial="hidden" animate="show">
        <PageHeader
          title="Users"
          subtitle="Search, moderate and create marketplace accounts"
          actions={
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setCreateOpen(true)}>
              + Create customer
            </button>
          }
        />
      </motion.header>

      <motion.div className="toolbar glass-inset" variants={stagger(0.05)} initial="hidden" animate="show">
        <form
          className="toolbar__search"
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', searchDraft.trim());
          }}
        >
          <input
            className="input"
            type="search"
            placeholder="Search by name or email…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search users"
          />
          <button type="submit" className="btn btn--ghost btn--sm">
            Search
          </button>
        </form>
        <select className="select" value={role} onChange={(e) => setParam('role', e.target.value)} aria-label="Filter by role">
          {STATUS_OPTIONS.role.map((r) => (
            <option key={r} value={r}>
              {r === '' ? 'All roles' : r}
            </option>
          ))}
        </select>
        <select className="select" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status">
          {STATUS_OPTIONS.account.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s}
            </option>
          ))}
        </select>
      </motion.div>

      <motion.section className="card" variants={fadeUp} initial="hidden" animate="show">
        {loading ? (
          <Skeleton rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <DataTable columns={columns} rows={items} getRowKey={(u) => u.id} emptyMessage="No users match these filters." />
            <Pagination
              meta={pagination}
              limit={limit}
              onPageChange={(p) => setParam('page', String(p))}
              onLimitChange={(l) => {
                const next = new URLSearchParams(params);
                next.set('limit', String(l));
                next.delete('page');
                setParams(next, { replace: true });
              }}
            />
          </>
        )}
      </motion.section>

      {/* Create modal */}
      <Modal
        open={createOpen}
        title="Create account"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </button>
            <button type="submit" form="create-user-form" className="btn btn--primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={submitCreate} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="cu-name">
              Full name *
            </label>
            <input id="cu-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {formErrors.name ? (
              <p className="field__error" role="alert">
                {formErrors.name}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="cu-email">
              Email *
            </label>
            <input id="cu-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {formErrors.email ? (
              <p className="field__error" role="alert">
                {formErrors.email}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="cu-password">
              Temporary password * <span className="field__hint-inline">8–72 characters</span>
            </label>
            <input
              id="cu-password"
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {formErrors.password ? (
              <p className="field__error" role="alert">
                {formErrors.password}
              </p>
            ) : null}
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor="cu-role">
                Role
              </label>
              <select id="cu-role" className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as CreateForm['role'] })}>
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="PARTNER">PARTNER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cu-phone">
                Phone <span className="field__hint-inline">(optional)</span>
              </label>
              <input id="cu-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {formErrors.phone ? (
                <p className="field__error" role="alert">
                  {formErrors.phone}
                </p>
              ) : null}
            </div>
          </div>
        </form>
      </Modal>

      {/* Moderation reason dialog */}
      <ReasonDialog
        open={pending !== null}
        title={
          pending?.action === 'SUSPEND'
            ? 'Suspend account'
            : pending?.action === 'DEACTIVATE'
              ? 'Deactivate account'
              : 'Reactivate account'
        }
        message={
          pending ? (
            <>
              You are about to <strong>{pending.action.toLowerCase()}</strong> <strong>{pending.user.name}</strong> (
              {pending.user.email}).
              {pending.action !== 'REACTIVATE' ? ' They will be signed out of all sessions.' : ''}
            </>
          ) : null
        }
        requireReason={pending?.action !== 'REACTIVATE'}
        reasonLabel={pending?.action === 'REACTIVATE' ? 'Note' : 'Reason'}
        confirmLabel={pending ? pending.action.charAt(0) + pending.action.slice(1).toLowerCase() : 'Confirm'}
        busy={moderationBusy}
        serverError={serverError}
        danger={pending?.action !== 'REACTIVATE'}
        onConfirm={(reason) => void runModeration(reason)}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
