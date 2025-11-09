import { useEffect, useState, useRef } from "preact/hooks";

type GalleryItem = {
  id: string;
  secure_url: string;
  public_id?: string;
  original_filename?: string;
  createdAt?: string;
};

export default function GalleryIsland({
  apiUrl = "/gallery",
}: {
  apiUrl?: string;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadImages = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setItems(json);
      } catch (err: any) {
        setError(err.message || "Failed to load gallery");
      } finally {
        setLoading(false);
      }
    };
    loadImages();
  }, []);

  if (error) return <div class="text-red-400">{error}</div>;
  if (loading && items.length === 0)
    return <div class="text-gray-400">Loading gallery…</div>;
  if (items.length === 0)
    return <div class="text-gray-400">No images yet.</div>;

  return (
    <section>
      <div
        ref={scrollRef}
        class="flex overflow-x-auto space-x-4 snap-x snap-mandatory pb-4 scroll-smooth"
      >
        {items.map((item, i) => {
          const thumb = item.secure_url.replace(
            "/upload/",
            "/upload/f_auto,q_auto,w_400/"
          );
          return (
            <div
              key={item.id}
              class="shrink-0 snap-center relative w-64 h-64 rounded-xl overflow-hidden shadow-lg cursor-pointer group"
              onClick={() => setLightboxIndex(i)}
            >
              <img
                src={thumb}
                alt={item.original_filename || `Gallery image ${i + 1}`}
                loading="lazy"
                decoding="async"
                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div class="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/60 to-transparent text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.original_filename}
              </div>
            </div>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}

/* Lightbox viewer */
function Lightbox({
  items,
  index,
  onClose,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);
  const item = items[current];

  const next = () => setCurrent((c) => (c + 1) % items.length);
  const prev = () => setCurrent((c) => (c - 1 + items.length) % items.length);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  if (!item) return null;

  const full = item.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");

  return (
    <div class="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
      <button
        class="absolute top-5 right-6 text-white text-3xl hover:text-gray-300"
        onClick={onClose}
      >
        &times;
      </button>

      <div class="flex items-center justify-center w-full h-full px-8">
        <button
          onClick={prev}
          class="text-white text-4xl px-4 hover:text-gray-400"
        >
          ‹
        </button>
        <img
          src={full}
          alt={item.original_filename}
          class="max-h-[90vh] max-w-[90vw] object-contain"
        />
        <button
          onClick={next}
          class="text-white text-4xl px-4 hover:text-gray-400"
        >
          ›
        </button>
      </div>

      <div class="text-sm text-gray-300 mt-2">{item.original_filename}</div>
      <a
        href={full}
        target="_blank"
        rel="noreferrer"
        class="text-violet-400 hover:underline mt-1"
      >
        Open in Cloudinary
      </a>
    </div>
  );
}
