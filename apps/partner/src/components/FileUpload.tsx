import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Upload, X } from 'lucide-react';
import { uploadFile, errorMessage } from '../lib/api';

export interface UploadEntry {
  id: string;
  name: string;
  url: string | null;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

let entryId = 1;

/**
 * Drag-and-drop / picker upload widget. Reads each file to a data URI and
 * posts it to `POST /uploads { file, folder }`, surfacing the returned URL.
 * `onChange` fires with the successfully uploaded URLs whenever they change.
 */
export function FileUpload({
  folder,
  label,
  hint,
  accept = 'image/*',
  multiple = false,
  maxFiles = 15,
  initialUrls = [],
  initialNames,
  disabled = false,
  onChange,
  compact = false,
}: {
  folder: 'listings' | 'avatars' | 'documents' | 'logos';
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  initialUrls?: string[];
  initialNames?: string[];
  disabled?: boolean;
  onChange: (urls: string[]) => void;
  compact?: boolean;
}) {
  const [entries, setEntries] = useState<UploadEntry[]>(() =>
    initialUrls.map((url, index) => ({
      id: `initial-${index}`,
      name: initialNames?.[index] ?? `File ${index + 1}`,
      url,
      status: 'done' as const,
    })),
  );
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const emit = useCallback(
    (next: UploadEntry[]) => {
      onChange(next.filter((entry) => entry.status === 'done' && entry.url).map((entry) => entry.url as string));
    },
    [onChange],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      setEntries((current) => {
        const room = Math.max(0, maxFiles - current.length);
        if (room === 0) return current;
        const accepted = list.slice(0, room);
        const newEntries: UploadEntry[] = accepted.map((file) => ({
          id: `upload-${entryId++}`,
          name: file.name,
          url: null,
          status: 'uploading' as const,
        }));
        const next = [...current, ...newEntries];
        void (async () => {
          for (const [index, entry] of newEntries.entries()) {
            const file = accepted[index]!;
            try {
              const url = await uploadFile(file, folder);
              setEntries((state) => {
                const updated = state.map((item) => (item.id === entry.id ? { ...item, url, status: 'done' as const } : item));
                emit(updated);
                return updated;
              });
            } catch (error) {
              setEntries((state) => {
                const updated = state.map((item) =>
                  item.id === entry.id ? { ...item, status: 'error' as const, error: errorMessage(error, 'Upload failed') } : item,
                );
                return updated;
              });
            }
          }
        })();
        return next;
      });
    },
    [folder, maxFiles, emit],
  );

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((current) => {
        const next = current.filter((entry) => entry.id !== id);
        emit(next);
        return next;
      });
    },
    [emit],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      if (!disabled) void handleFiles(event.dataTransfer.files);
    },
    [disabled, handleFiles],
  );

  return (
    <div className="file-upload">
      <span className="field__label">{label}</span>
      {hint ? <p className="field__hint">{hint}</p> : null}
      <div
        className={`dropzone ${dragging ? 'dropzone--active' : ''} ${compact ? 'dropzone--compact' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label={label}
      >
        <span className="dropzone__icon" aria-hidden="true">
          <Upload size={22} strokeWidth={1.9} />
        </span>
        <span className="dropzone__text">Drop files here or click to browse</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {entries.length > 0 ? (
        <ul className="upload-list">
          {entries.map((entry) => (
            <li key={entry.id} className={`upload-list__item upload-list__item--${entry.status}`}>
              {entry.url ? (
                <img className="upload-list__thumb" src={entry.url} alt="" />
              ) : (
                <span className="upload-list__thumb upload-list__thumb--placeholder" aria-hidden="true" />
              )}
              <span className="upload-list__meta">
                <span className="upload-list__name">{entry.name}</span>
                {entry.status === 'uploading' ? <span className="upload-list__status">Uploading…</span> : null}
                {entry.status === 'error' ? <span className="upload-list__status upload-list__status--error">{entry.error}</span> : null}
              </span>
              <button
                type="button"
                className="upload-list__remove"
                onClick={() => removeEntry(entry.id)}
                aria-label={`Remove ${entry.name}`}
                disabled={entry.status === 'uploading'}
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
