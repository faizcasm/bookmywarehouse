import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { LISTING_TYPES, type ListingType } from '../lib/types';
import { ListingForm, type ListingFormSubmitResult } from '../components/ListingForm';
import { LISTING_TYPE_LABELS } from '../lib/listingForm';
import { useToast } from '../components/Toast';

const TYPE_HINTS: Record<ListingType, string> = {
  WAREHOUSE: 'Storage space by the pallet, square foot or unit.',
  EQUIPMENT: 'Forklifts, cranes and material-handling gear on hire.',
  SERVICE: 'Loading, packaging, transport and warehouse services.',
};

export function ListingNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [type, setType] = useState<ListingType>('WAREHOUSE');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit({ payload }: ListingFormSubmitResult): Promise<void> {
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; slug: string; status: string }>('/partner/listings', payload);
      toast.success('Listing created as a draft. Add photos, then submit it for review.');
      navigate(`/listings/${created.id}`, { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="page__intro">
        <h2>Create a new listing</h2>
        <p className="muted">
          Pick the listing type — the required details change accordingly. Need to change something later?{' '}
          <Link to="/listings">Back to listings</Link>.
        </p>
      </div>

      <div className="type-tabs" role="tablist" aria-label="Listing type">
        {LISTING_TYPES.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            className={`type-tab ${type === value ? 'type-tab--active' : ''}`}
            onClick={() => setType(value)}
          >
            <strong>{LISTING_TYPE_LABELS[value]}</strong>
            <span>{TYPE_HINTS[value]}</span>
          </button>
        ))}
      </div>

      {/* Remount the form when the type changes so type-specific state resets. */}
      <ListingForm key={type} type={type} mode="create" submitting={submitting} onSubmit={handleSubmit} />
    </div>
  );
}

export default ListingNewPage;
