import { useEffect, useState } from "preact/hooks";
import gsap from "gsap";

export default function GridMotion() {
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    const el = document.getElementById("grid-data");
    if (el) setPhotos(JSON.parse(el.dataset.items ?? "[]"));
  }, []);

  useEffect(() => {
    if (photos.length === 0) return;
    gsap.ticker.lagSmoothing(0);
    let mouseX = window.innerWidth / 2;

    const handleMouseMove = (e: MouseEvent) => (mouseX = e.clientX);
    const updateMotion = () => {
      const rows = document.querySelectorAll<HTMLDivElement>(".grid-row");
      const maxMove = 300,
        base = 0.8,
        inertia = [0.6, 0.4, 0.3, 0.2];
      rows.forEach((row, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        const move =
          ((mouseX / window.innerWidth) * maxMove - maxMove / 2) * dir;
        gsap.to(row, {
          x: move,
          duration: base + inertia[i % inertia.length],
          ease: "power3.out",
          overwrite: "auto",
        });
      });
    };

    const ticker = gsap.ticker.add(updateMotion);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      gsap.ticker.remove(ticker);
    };
  }, [photos]);

  if (photos.length === 0) return null;

  const rows = [0, 1, 2, 3];
  return (
    <section
      className="w-full h-screen overflow-hidden relative flex items-center justify-center opacity-20 z-0"
      style={{
        background:
          "radial-gradient(circle, rgba(17,24,39,0.8) 0%, transparent 100%)",
      }}
    >
      <div
        id="grid-container"
        className="gap-4 flex-none relative w-[150vw] h-[150vh] grid grid-rows-4 grid-cols-1 rotate-[-15deg] origin-center"
      >
        {rows.map((r) => (
          <div key={r} className="grid gap-4 grid-cols-7 grid-row" data-row={r}>
            {Array.from({ length: 7 }).map((_, i) => {
              const index = (r * 7 + i) % photos.length;
              return (
                <div key={i} className="relative">
                  <div className="relative w-full h-full overflow-hidden rounded-[10px] bg-[#111]">
                    <img
                      src={photos[index]}
                      alt={`Grid item ${index + 1}`}
                      className="w-full h-full object-cover absolute top-0 left-0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
