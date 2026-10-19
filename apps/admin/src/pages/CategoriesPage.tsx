import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog, Modal } from '../components/Modal';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { Tabs } from '../components/Tabs';
import { useToast } from '../components/Toast';
import { apiSend, ApiError } from '../lib/api';
import { errorMessage, useFetch } from '../lib/hooks';
import { formatNumber } from '../lib/format';
import type { CategoryDTO, ListingType } from '../lib/types';

const TYPE_TABS = [
  { id: '', label: 'All' },
  { id: 'WAREHOUSE', label: 'Warehouse' },
  { id: 'EQUIPMENT', label: 'Equipment' },
  { id: 'SERVICE', label: 'Service' },
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface CategoryForm {
  name: string;
  slug: string;
  type: ListingType;
  description: string;
  icon: string;
  imageUrl: string;
  parentId: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  slug: '',
  type: 'WAREHOUSE',
  description: '',
  icon: '',
  imageUrl: '',
  parentId: '',
  isActive: true,
  sortOrder: '0',
};

function toForm(c: CategoryDTO): CategoryForm {
  return {
    name: c.name,
    slug: c.slug,
    type: c.type,
    description: c.description ?? '',
    icon: c.icon ?? '',
    imageUrl: c.imageUrl ?? '',
    parentId: c.parentId ?? '',
    isActive: c.isActive,
    sortOrder: String(c.sortOrder ?? 0),
  };
}

export function CategoriesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<{ items: CategoryDTO[] } | CategoryDTO[]>('/admin/categories?includeInactive=true');
  const [typeFilter, setTypeFilter] = useState('');

  const all: CategoryDTO[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return data.items ?? [];
  }, [data]);

  const items = typeFilter ? all.filter((c) => c.type === typeFilter) : all;

  // ---- create/edit modal ----
  const [editing, setEditing] = useState<CategoryDTO | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (c: CategoryDTO) => {
    setEditing(c);
    setForm(toForm(c));
    setFormErrors({});
    setModalOpen(true);
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2 || form.name.trim().length > 80) errs.name = 'Name must be 2–80 characters.';
    if (!SLUG_RE.test(form.slug.trim())) errs.slug = 'Slug must be lowercase letters, numbers and hyphens.';
    const sortOrder = Number(form.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000) errs.sortOrder = 'Sort order must be 0–10000.';
    return errs;
  };

  const submit = async () => {
    const errs = validate();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      type: form.type,
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      parentId: form.parentId || null,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
    };
    try {
      if (editing) {
        // API update only applies name/description/icon/imageUrl/isActive/sortOrder
        await apiSend('PATCH', `/admin/categories/${editing.id}`, payload);
        toast.success(`Category “${payload.name}” updated.`);
      } else {
        await apiSend('POST', '/admin/categories', payload);
        toast.success(`Category “${payload.name}” created.`);
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      if (err instanceof ApiError) setFormErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---- activate/deactivate toggle ----
  const [toggling, setToggling] = useState<CategoryDTO | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const runToggle = async () => {
    if (!toggling) return;
    setToggleBusy(true);
    try {
      await apiSend('PATCH', `/admin/categories/${toggling.id}`, { isActive: !toggling.isActive });
      toast.success(`${toggling.name} ${toggling.isActive ? 'deactivated' : 'activated'}.`);
      setToggling(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setToggleBusy(false);
    }
  };

  const columns: Column<CategoryDTO>[] = [
    {
      key: 'name',
      header: 'Category',
      render: (c) => (
        <div className="cell-stack">
          <strong>{c.name}</strong>
          <span className="muted">
            /{c.slug}
          </span>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (c) => <span className="chip chip--info">{c.type}</span> },
    { key: 'listings', header: 'Listings', align: 'right', render: (c) => formatNumber(c.listingCount ?? 0) },
    { key: 'sort', header: 'Sort', align: 'right', secondary: true, render: (c) => c.sortOrder },
    {
      key: 'active',
      header: 'Status',
      render: (c) => <StatusBadge status={c.isActive ? 'ACTIVE' : 'INACTIVE'} tone={c.isActive ? 'success' : 'neutral'} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="cell-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(c)}>
            Edit
          </button>
          <button
            type="button"
            className={`btn btn--sm ${c.isActive ? 'btn--danger-ghost' : 'btn--primary'}`}
            onClick={() => setToggling(c)}
          >
            {c.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Catalog taxonomy for warehouses, equipment and services"
        actions={
          <button type="button" className="btn btn--primary btn--sm" onClick={openCreate}>
            + New category
          </button>
        }
      />
      <Tabs tabs={TYPE_TABS} active={typeFilter} onChange={setTypeFilter} ariaLabel="Category type" />

      <section className="card">
        {loading ? (
          <Skeleton rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <DataTable columns={columns} rows={items} getRowKey={(c) => c.id} emptyMessage="No categories yet." />
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.name}` : 'New category'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="category-form" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
            </button>
          </>
        }
      >
        <form
          id="category-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor="cat-name">
                Name * <span className="field__hint-inline">2–80 chars</span>
              </label>
              <input id="cat-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {formErrors.name ? (
                <p className="field__error" role="alert">
                  {formErrors.name}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cat-slug">
                Slug * <span className="field__hint-inline">e.g. cold-storage</span>
              </label>
              <input
                id="cat-slug"
                className="input"
                value={form.slug}
                disabled={Boolean(editing)}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
              {formErrors.slug ? (
                <p className="field__error" role="alert">
                  {formErrors.slug}
                </p>
              ) : null}
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor="cat-type">
                Type
              </label>
              <select id="cat-type" className="select" value={form.type} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, type: e.target.value as ListingType })}>
                <option value="WAREHOUSE">WAREHOUSE</option>
                <option value="EQUIPMENT">EQUIPMENT</option>
                <option value="SERVICE">SERVICE</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cat-parent">
                Parent <span className="field__hint-inline">(optional)</span>
              </label>
              <select id="cat-parent" className="select" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                <option value="">— none —</option>
                {all
                  .filter((c) => c.id !== editing?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="cat-desc">
              Description <span className="field__hint-inline">(optional, max 600)</span>
            </label>
            <textarea id="cat-desc" className="textarea" rows={3} maxLength={600} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor="cat-icon">
                Icon <span className="field__hint-inline">(optional)</span>
              </label>
              <input id="cat-icon" className="input" maxLength={60} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cat-sort">
                Sort order
              </label>
              <input id="cat-sort" className="input" type="number" min={0} max={10000} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              {formErrors.sortOrder ? (
                <p className="field__error" role="alert">
                  {formErrors.sortOrder}
                </p>
              ) : null}
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="cat-image">
              Image URL <span className="field__hint-inline">(optional)</span>
            </label>
            <input id="cat-image" className="input" maxLength={1000} value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            <span>Active (visible in the catalog)</span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.isActive ? 'Deactivate category' : 'Activate category'}
        message={
          toggling ? (
            <>
              {toggling.isActive ? (
                <>
                  Deactivate <strong>{toggling.name}</strong>? It will be hidden from the catalog for new bookings.
                </>
              ) : (
                <>
                  Activate <strong>{toggling.name}</strong>? It will become selectable again.
                </>
              )}
            </>
          ) : null
        }
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
        danger={Boolean(toggling?.isActive)}
        busy={toggleBusy}
        onConfirm={() => void runToggle()}
        onCancel={() => setToggling(null)}
      />
    </>
  );
}
