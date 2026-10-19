import { useEffect, useRef, useState } from 'react';

export interface ImageGalleryProps {
  images: string[];
  alt: string;
}

export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const list = images && images.length > 0 ? images : [];
  const [index, setIndex] = useState(0);
  const mainRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setIndex(0);
  }, [images]);

  if (list.length === 0) {
    return <div className="gallery-empty">No photos available</div>;
  }

  const clamp = (value: number) => Math.max(0, Math.min(list.length - 1, value));

  return (
    <div className="gallery">
      <div className="gallery-main">
        <img ref={mainRef} src={list[index]} alt={`${alt} — photo ${index + 1} of ${list.length}`} />
        {list.length > 1 ? (
          <>
            <button
              type="button"
              className="gallery-nav gallery-prev"
              aria-label="Previous photo"
              onClick={() => setIndex((i) => clamp(i - 1))}
            >
              ‹
            </button>
            <button
              type="button"
              className="gallery-nav gallery-next"
              aria-label="Next photo"
              onClick={() => setIndex((i) => clamp(i + 1))}
            >
              ›
            </button>
          </>
        ) : null}
        <span className="gallery-counter">
          {index + 1} / {list.length}
        </span>
      </div>
      {list.length > 1 ? (
        <div className="gallery-thumbs" role="tablist" aria-label="Photo thumbnails">
          {list.map((image, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show photo ${i + 1}`}
              className={`gallery-thumb ${i === index ? 'is-active' : ''}`}
              onClick={() => setIndex(i)}
            >
              <img src={image} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
