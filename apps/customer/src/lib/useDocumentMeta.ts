import { useEffect } from 'react';

export interface DocumentMetaInput {
  title: string;
  description?: string;
  ogTitle?: string;
  ogUrl?: string;
}

interface ManagedMeta {
  attr: 'name' | 'property';
  key: string;
  content: string | undefined;
}

/** Upsert a <meta> tag in <head>; returns the element that was touched. */
function upsertMeta(attr: 'name' | 'property', key: string, content: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return el;
}

/**
 * Per-page <title> + description / Open Graph meta tags.
 * Sets values on mount (and whenever they change) and restores the previous
 * values on unmount so navigating away doesn't leave stale metadata behind.
 */
export function useDocumentMeta({ title, description, ogTitle, ogUrl }: DocumentMetaInput): void {
  useEffect(() => {
    const previousTitle = document.title;
    const specs: ManagedMeta[] = [
      { attr: 'name', key: 'description', content: description },
      { attr: 'property', key: 'og:title', content: ogTitle ?? title },
      { attr: 'property', key: 'og:description', content: description },
      {
        attr: 'property',
        key: 'og:url',
        content: ogUrl ?? `${window.location.origin}${window.location.pathname}`,
      },
    ];

    const previous = specs.map((spec) => {
      const existing = document.head.querySelector<HTMLMetaElement>(
        `meta[${spec.attr}="${spec.key}"]`,
      );
      return { ...spec, existed: Boolean(existing), value: existing?.getAttribute('content') ?? null };
    });

    document.title = title;
    for (const spec of specs) {
      if (spec.content !== undefined) upsertMeta(spec.attr, spec.key, spec.content);
    }

    return () => {
      document.title = previousTitle;
      for (const spec of previous) {
        if (!spec.existed) {
          document.head.querySelector(`meta[${spec.attr}="${spec.key}"]`)?.remove();
        } else if (spec.value !== null) {
          upsertMeta(spec.attr, spec.key, spec.value);
        }
      }
    };
  }, [title, description, ogTitle, ogUrl]);
}
