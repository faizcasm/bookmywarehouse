import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage, isApiError } from '../lib/api';
import { daysOfWeekLabels, formatDayShort, formatMoney } from '../lib/format';
import type { AvailabilityExceptionDTO, AvailabilityRuleDTO, ListingDetailDTO } from '../lib/types';
import { emptyListingValues, listingValuesFromDetail } from '../lib/listingForm';
import {
  validateAvailabilityException,
  validateAvailabilityRule,
  type AvailabilityExceptionValues,
  type AvailabilityRuleValues,
  type FieldErrors,
} from '../lib/validation';
import { ListingForm, type ListingFormSubmitResult } from '../components/ListingForm';
import { Tabs } from '../components/Tabs';
import { RatingStars, StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/Modal';
import { ErrorState, ListSkeleton } from '../components/States';
import { useToast } from '../components/Toast';

/* ------------------------------------------------------------------ */
/* Availability panel                                                  */
/* ------------------------------------------------------------------ */

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0]; // Mon…Sun

function AvailabilityPanel({ listingId }: { listingId: string }) {
  const toast = useToast();
  const [rules, setRules] = useState<AvailabilityRuleDTO[]>([]);
  const [blockedDates, setBlockedDates] = useState<AvailabilityExceptionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [ruleValues, setRuleValues] = useState<AvailabilityRuleValues>({
    daysOfWeek: [],
    startTime: '09:00',
    endTime: '18:00',
    startDate: '',
    endDate: '',
  });
  const [ruleErrors, setRuleErrors] = useState<FieldErrors>({});
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  const [exceptionValues, setExceptionValues] = useState<AvailabilityExceptionValues>({ date: '', reason: '', isAvailable: false });
  const [exceptionErrors, setExceptionErrors] = useState<FieldErrors>({});
  const [exceptionFormError, setExceptionFormError] = useState<string | null>(null);
  const [savingException, setSavingException] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<{ kind: 'rule' | 'exception'; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ rules: AvailabilityRuleDTO[]; blockedDates: AvailabilityExceptionDTO[] }>(
        `/partner/listings/${listingId}/availability`,
      );
      // The API currently returns raw lean docs here (`_id` instead of `id`).
      setRules(
        (data.rules ?? []).map((rule) => ({
          ...rule,
          id: rule.id ?? (rule as unknown as { _id?: string })._id ?? '',
        })),
      );
      setBlockedDates(
        (data.blockedDates ?? []).map((exception) => ({
          ...exception,
          id: exception.id ?? (exception as unknown as { _id?: string })._id ?? '',
        })),
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitRule(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setRuleFormError(null);
    const validation = validateAvailabilityRule(ruleValues);
    setRuleErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSavingRule(true);
    try {
      await api.post('/partner/availability-rules', {
        listingId,
        daysOfWeek: ruleValues.daysOfWeek,
        startTime: ruleValues.startTime.trim(),
        endTime: ruleValues.endTime.trim(),
        startDate: ruleValues.startDate ? new Date(`${ruleValues.startDate}T00:00:00.000Z`).toISOString() : null,
        endDate: ruleValues.endDate ? new Date(`${ruleValues.endDate}T00:00:00.000Z`).toISOString() : null,
      });
      toast.success('Availability rule added.');
      setRuleValues({ daysOfWeek: [], startTime: '09:00', endTime: '18:00', startDate: '', endDate: '' });
      setRuleErrors({});
      await load();
    } catch (error) {
      if (isApiError(error) && error.issues.length > 0) {
        setRuleErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
        setRuleFormError(error.message);
      } else {
        setRuleFormError(errorMessage(error, 'Could not add the rule'));
      }
    } finally {
      setSavingRule(false);
    }
  }

  async function submitException(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setExceptionFormError(null);
    const validation = validateAvailabilityException(exceptionValues);
    setExceptionErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSavingException(true);
    try {
      await api.post('/partner/availability-exceptions', {
        listingId,
        date: new Date(`${exceptionValues.date}T00:00:00.000Z`).toISOString(),
        reason: exceptionValues.reason?.trim() || null,
        isAvailable: exceptionValues.isAvailable,
      });
      toast.success(exceptionValues.isAvailable ? 'Date opened for booking.' : 'Date blocked.');
      setExceptionValues({ date: '', reason: '', isAvailable: false });
      setExceptionErrors({});
      await load();
    } catch (error) {
      if (isApiError(error) && error.issues.length > 0) {
        setExceptionErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
        setExceptionFormError(error.message);
      } else {
        setExceptionFormError(errorMessage(error, 'Could not save the date'));
      }
    } finally {
      setSavingException(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const path =
        pendingDelete.kind === 'rule'
          ? `/partner/availability-rules/${pendingDelete.id}`
          : `/partner/availability-exceptions/${pendingDelete.id}`;
      await api.del(path);
      toast.success(pendingDelete.kind === 'rule' ? 'Rule removed.' : 'Date entry removed.');
      setPendingDelete(null);
      await load();
    } catch (err) {
      toast.errorFrom(err, 'Could not remove the entry');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <ListSkeleton rows={4} />;
  if (error) return <ErrorState error={error} onRetry={() => void load()} title="Could not load availability" />;

  return (
    <div className="availability stack">
      <section className="card" aria-labelledby="rules-heading">
        <div className="card__header">
          <h3 className="card__title" id="rules-heading">
            Weekly opening hours
          </h3>
        </div>
        {rules.length === 0 ? (
          <p className="muted">No opening-hours rules yet. Without rules the listing is treated as always available.</p>
        ) : (
          <ul className="rule-list">
            {rules.map((rule) => (
              <li key={rule.id} className="rule-list__item">
                <div>
                  <strong>{daysOfWeekLabels(rule.daysOfWeek)}</strong>
                  <span className="muted">
                    {' '}
                    {rule.startTime}–{rule.endTime}
                    {rule.startDate || rule.endDate ? ` · ${rule.startDate ? formatDayShort(rule.startDate) : '…'} – ${rule.endDate ? formatDayShort(rule.endDate) : '…'}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--danger-ghost btn--sm"
                  onClick={() => setPendingDelete({ kind: 'rule', id: rule.id, label: `${daysOfWeekLabels(rule.daysOfWeek)} ${rule.startTime}–${rule.endTime}` })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="rule-form" onSubmit={(event) => void submitRule(event)} noValidate>
          {ruleFormError ? (
            <div className="alert alert--error" role="alert">
              {ruleFormError}
            </div>
          ) : null}
          <fieldset className="fieldset fieldset--inline">
            <legend className="field__label">Days *</legend>
            <div className="checkbox-row">
              {DAY_OPTIONS.map((day) => (
                <label key={day} className="checkbox">
                  <input
                    type="checkbox"
                    checked={ruleValues.daysOfWeek.includes(day)}
                    onChange={() =>
                      setRuleValues((current) => ({
                        ...current,
                        daysOfWeek: current.daysOfWeek.includes(day)
                          ? current.daysOfWeek.filter((item) => item !== day)
                          : [...current.daysOfWeek, day],
                      }))
                    }
                  />
                  {daysOfWeekLabels([day])}
                </label>
              ))}
            </div>
            {ruleErrors.daysOfWeek ? <span className="field__error">{ruleErrors.daysOfWeek}</span> : null}
          </fieldset>
          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor="rule-start-time">
                From *
              </label>
              <input
                id="rule-start-time"
                type="time"
                className={`input ${ruleErrors.startTime ? 'input--invalid' : ''}`}
                value={ruleValues.startTime}
                onChange={(event) => setRuleValues((current) => ({ ...current, startTime: event.target.value }))}
              />
              {ruleErrors.startTime ? <span className="field__error">{ruleErrors.startTime}</span> : null}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="rule-end-time">
                To *
              </label>
              <input
                id="rule-end-time"
                type="time"
                className={`input ${ruleErrors.endTime ? 'input--invalid' : ''}`}
                value={ruleValues.endTime}
                onChange={(event) => setRuleValues((current) => ({ ...current, endTime: event.target.value }))}
              />
              {ruleErrors.endTime ? <span className="field__error">{ruleErrors.endTime}</span> : null}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="rule-start-date">
                Valid from
              </label>
              <input
                id="rule-start-date"
                type="date"
                className="input"
                value={ruleValues.startDate ?? ''}
                onChange={(event) => setRuleValues((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="rule-end-date">
                Valid until
              </label>
              <input
                id="rule-end-date"
                type="date"
                className={`input ${ruleErrors.endDate ? 'input--invalid' : ''}`}
                value={ruleValues.endDate ?? ''}
                onChange={(event) => setRuleValues((current) => ({ ...current, endDate: event.target.value }))}
              />
              {ruleErrors.endDate ? <span className="field__error">{ruleErrors.endDate}</span> : null}
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn--secondary" disabled={savingRule}>
              {savingRule ? 'Adding…' : 'Add rule'}
            </button>
          </div>
        </form>
      </section>

      <section className="card" aria-labelledby="blocked-heading">
        <div className="card__header">
          <h3 className="card__title" id="blocked-heading">
            Blocked / special dates
          </h3>
        </div>
        {blockedDates.length === 0 ? (
          <p className="muted">No blocked dates.</p>
        ) : (
          <ul className="rule-list">
            {blockedDates.map((exception) => (
              <li key={exception.id} className="rule-list__item">
                <div>
                  <strong>{formatDayShort(exception.date)}</strong>{' '}
                  <span className={exception.isAvailable ? 'muted' : 'text-blocked'}>
                    {exception.isAvailable ? 'Opened for booking' : 'Blocked'}
                  </span>
                  {exception.reason ? <span className="muted"> — {exception.reason}</span> : null}
                </div>
                <button
                  type="button"
                  className="btn btn--danger-ghost btn--sm"
                  onClick={() => setPendingDelete({ kind: 'exception', id: exception.id, label: formatDayShort(exception.date) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="rule-form" onSubmit={(event) => void submitException(event)} noValidate>
          {exceptionFormError ? (
            <div className="alert alert--error" role="alert">
              {exceptionFormError}
            </div>
          ) : null}
          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor="exception-date">
                Date *
              </label>
              <input
                id="exception-date"
                type="date"
                className={`input ${exceptionErrors.date ? 'input--invalid' : ''}`}
                value={exceptionValues.date}
                onChange={(event) => setExceptionValues((current) => ({ ...current, date: event.target.value }))}
              />
              {exceptionErrors.date ? <span className="field__error">{exceptionErrors.date}</span> : null}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="exception-reason">
                Reason
              </label>
              <input
                id="exception-reason"
                className="input"
                placeholder="e.g. Annual maintenance"
                value={exceptionValues.reason ?? ''}
                onChange={(event) => setExceptionValues((current) => ({ ...current, reason: event.target.value }))}
              />
              {exceptionErrors.reason ? <span className="field__error">{exceptionErrors.reason}</span> : null}
            </div>
            <div className="field field--checkbox">
              <span className="field__label">Mode</span>
              <div className="checkbox-row">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={exceptionValues.isAvailable}
                    onChange={(event) => setExceptionValues((current) => ({ ...current, isAvailable: event.target.checked }))}
                  />
                  Open this date (otherwise it is blocked)
                </label>
              </div>
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn--secondary" disabled={savingException}>
              {savingException ? 'Saving…' : 'Add date'}
            </button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'rule' ? 'Remove availability rule?' : 'Remove date entry?'}
        message={pendingDelete ? `This will remove “${pendingDelete.label}”.` : ''}
        confirmLabel="Remove"
        danger
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail page                                                         */
/* ------------------------------------------------------------------ */

export function ListingDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [detail, setDetail] = useState<ListingDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState('details');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await api.get<ListingDetailDTO>(`/partner/listings/${id}`));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const initialValues = useMemo(() => (detail ? listingValuesFromDetail(detail) : emptyListingValues()), [detail]);

  async function handleSave({ payload }: ListingFormSubmitResult): Promise<void> {
    setSaving(true);
    try {
      await api.patch(`/partner/listings/${id}`, payload);
      toast.success('Listing updated.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <ListSkeleton rows={6} />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={() => void load()} title="Could not load the listing" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="detail-header card">
        {detail.coverImage ? (
          <img className="detail-header__cover" src={detail.coverImage} alt="" />
        ) : (
          <span className="detail-header__cover detail-header__cover--placeholder" aria-hidden="true" />
        )}
        <div className="detail-header__body">
          <div className="detail-header__title-row">
            <h2>{detail.title}</h2>
            <StatusBadge value={detail.status} kind="listing" />
          </div>
          <p className="muted">
            {detail.type} · {detail.categoryName ?? 'Uncategorised'} · {detail.city}, {detail.state}
          </p>
          <p>
            <strong>{formatMoney(detail.price.amount, detail.price.currency)}</strong>
            <span className="muted"> {detail.price.unitLabel ?? (detail.price.period ? `per ${detail.price.period.toLowerCase()}` : '')}</span>
            {detail.status === 'PENDING_REVIEW' ? <span className="muted"> · Waiting for admin approval before going live</span> : null}
          </p>
          <div className="detail-header__meta">
            <RatingStars value={detail.rating?.average ?? 0} count={detail.rating?.count ?? 0} />
            <span className="muted">Created {formatDayShort(detail.createdAt)}</span>
            <span className="muted">Slug: /{detail.slug}</span>
          </div>
          <div className="row-actions">
            <Link to="/listings" className="btn btn--ghost btn--sm">
              ← All listings
            </Link>
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'details', label: 'Details & edit' },
          { id: 'availability', label: 'Availability' },
        ]}
        active={tab}
        onChange={setTab}
        label="Listing sections"
      />

      {tab === 'details' ? (
        <ListingForm key={detail.id} type={detail.type} mode="edit" initial={initialValues} submitting={saving} onSubmit={handleSave} />
      ) : (
        <AvailabilityPanel listingId={detail.id} />
      )}
    </div>
  );
}

export default ListingDetailPage;
