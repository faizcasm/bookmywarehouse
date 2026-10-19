export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
}

export function Tabs({
  tabs,
  active,
  onChange,
  label = 'Sections',
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`tab ${active === tab.id ? 'tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.badge !== undefined ? <span className="tab__badge">{tab.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
