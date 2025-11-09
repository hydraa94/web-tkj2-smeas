// src/components/SongfessIsland.tsx
// ============================================================================
//  SongfessIsland.tsx
//  Frontend for displaying and submitting anonymous "Songfess" messages.
//  Users can write a message, optionally dedicate it to someone, search for a
//  Spotify song (through backend proxy), and send the confession to Firestore.
// ============================================================================

import { useEffect, useState } from "preact/hooks";
import SpotifyEmbed from "./SpotifyEmbed";

// ==== Type Definitions =======================================================

type Track = {
  url: string; // Spotify track URL
  embedUrl: string; // Spotify embeddable player URL
  id: string; // Spotify track ID
  name: string; // Track name
  artist: string; // Artist(s)
  coverImage: string; // Album art
};

type Songfess = {
  id: string;
  message: string;
  recipient?: string;
  track?: Track;
  createdAt: string;
};

// ==== Component ==============================================================
export default function SongfessIsland({
  apiUrl = "/songfess",
}: {
  apiUrl?: string;
}) {
  // ---- State Variables ------------------------------------------------------
  const [songfesses, setSongfesses] = useState<Songfess[]>([]);
  const [form, setForm] = useState({
    message: "",
    recipient: "",
    songQuery: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [songResults, setSongResults] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  // ==== Fetch existing messages =============================================
  useEffect(() => {
    console.info("[Songfess] Initializing component, fetching confessions...");
    (async () => {
      try {
        const res = await fetch(apiUrl);
        console.debug(`[Songfess] GET ${apiUrl} -> ${res.status}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.info(
          `[Songfess] Loaded ${data.length} confessions from backend.`
        );
        setSongfesses(data);
      } catch (err: any) {
        console.error("[Songfess] Failed to load confessions:", err);
        setError(err.message || "Failed to load messages");
      }
    })();
  }, [apiUrl]);

  // ==== Submit new confession ===============================================
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    console.log("[Songfess] Submit triggered with form:", form);

    if (!form.message.trim()) {
      console.warn("[Songfess] Attempted to send empty message.");
      alert("Message cannot be empty.");
      return;
    }

    setLoading(true);
    console.log("[Songfess] Preparing payload for submission...");

    try {
      const payload = {
        message: form.message.trim(),
        recipient: form.recipient.trim(),
        songUrl: selectedSong?.url || "",
      };

      console.debug("[Songfess] Sending POST request to backend:", payload);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.debug(`[Songfess] POST ${apiUrl} -> ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Refetch updated data
      console.info("[Songfess] Fetching updated confessions...");
      const updated = await (await fetch(apiUrl)).json();
      console.info(
        `[Songfess] Total confessions after update: ${updated.length}`
      );
      setSongfesses(updated);

      // Reset form state
      setForm({ message: "", recipient: "", songQuery: "" });
      setSelectedSong(null);
      setSongResults([]);
      console.log("[Songfess] Form reset completed.");
    } catch (err: any) {
      console.error("[Songfess] Error during submission:", err);
      alert("Failed to send: " + err.message);
    } finally {
      setLoading(false);
      console.debug("[Songfess] Submission process finished.");
    }
  };

  // ==== Search songs on Spotify (through backend proxy) =====================
  const handleSearchClick = async () => {
    const query = form.songQuery.trim();
    if (!query) {
      console.warn("[Songfess] Search attempted with empty query.");
      alert("Please enter a song title or artist to search.");
      return;
    }

    setSearching(true);
    console.info(`[Songfess] Searching for songs with query: "${query}"`);

    try {
      const res = await fetch(
        `${apiUrl}/search?q=${encodeURIComponent(query)}`
      );
      console.debug(`[Songfess] GET ${apiUrl}/search -> ${res.status}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);

      const data = await res.json();
      console.info(
        `[Songfess] Received ${data.length} tracks from Spotify search.`
      );
      setSongResults(data.slice(0, 5));
    } catch (err) {
      console.error("[Songfess] Spotify search error:", err);
      alert("Could not fetch songs from Spotify.");
    } finally {
      setSearching(false);
      console.debug("[Songfess] Search process completed.");
    }
  };

  // ==== Select song from dropdown ===========================================
  const handleSongSelect = (song: any) => {
    console.log("[Songfess] Song selected:", song);
    setSelectedSong(song);
    setSongResults([]);
  };

  // ==== Render UI ===========================================================
  return (
    <section class="space-y-10">
      {/* =================================================================== */}
      {/*  FORM: Compose and send message                                     */}
      {/* =================================================================== */}
      <form
        onSubmit={handleSubmit}
        class="bg-gray-800/70 backdrop-blur-sm border border-gray-700 p-6 rounded-2xl shadow-md max-w-xl mx-auto space-y-4 relative"
      >
        {/* ---- Message Field --------------------------------------------- */}
        <textarea
          value={form.message}
          onInput={(e) =>
            setForm({
              ...form,
              message: (e.target as HTMLTextAreaElement).value,
            })
          }
          placeholder="Write your anonymous message..."
          class="w-full h-28 p-3 rounded-xl bg-gray-900 border border-gray-700 text-white resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          maxLength={500}
          required
        />

        {/* ---- Recipient Field ------------------------------------------- */}
        <input
          type="text"
          placeholder="Recipient (optional)"
          value={form.recipient}
          onInput={(e) =>
            setForm({
              ...form,
              recipient: (e.target as HTMLInputElement).value,
            })
          }
          class="w-full p-3 rounded-xl bg-gray-900 border border-gray-700 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />

        {/* ---- Song Search Section --------------------------------------- */}
        <div class="relative">
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Enter song title or artist..."
              value={form.songQuery}
              onInput={(e) =>
                setForm({
                  ...form,
                  songQuery: (e.target as HTMLInputElement).value,
                })
              }
              class="flex-grow p-3 rounded-xl bg-gray-900 border border-gray-700 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <button
              type="button"
              onClick={handleSearchClick}
              disabled={searching}
              class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-60"
            >
              {searching ? "Searching..." : "Search Song"}
            </button>
          </div>

          {/* ---- Search Results Dropdown --------------------------------- */}
          {songResults.length > 0 && (
            <ul class="absolute z-20 mt-2 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {songResults.map((song) => (
                <li
                  key={song.id}
                  class="px-4 py-3 hover:bg-green-500/20 cursor-pointer transition-colors flex items-center space-x-3"
                  onClick={() => handleSongSelect(song)}
                >
                  <img
                    src={song.image}
                    alt={song.name}
                    class="w-10 h-10 rounded-md object-cover"
                  />
                  <div class="truncate">
                    <p class="font-semibold text-white truncate">{song.name}</p>
                    <p class="text-xs text-gray-400 truncate">{song.artist}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* ---- Selected Song Indicator --------------------------------- */}
          {selectedSong && (
            <p class="mt-2 text-sm text-gray-400">
              Selected:&nbsp;
              <span class="text-green-400 font-semibold">
                {selectedSong.name}
              </span>
              &nbsp;– {selectedSong.artist}
            </p>
          )}
        </div>

        {/* ---- Submit Button --------------------------------------------- */}
        <button
          disabled={loading}
          type="submit"
          class="w-full py-3 bg-linear-to-r from-green-500 to-emerald-600 hover:opacity-90 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send Confession"}
        </button>
      </form>

      {/* =================================================================== */}
      {/*  CONFESSIONS LIST: Horizontal scroll of songfesses                 */}
      {/* =================================================================== */}
      <div class="flex overflow-x-auto space-x-6 snap-x snap-mandatory pb-6 px-2 md:px-6 scrollbar-thin scrollbar-thumb-green-600/60 scrollbar-track-gray-800">
        {songfesses.map((s, i) => {
          const track = s.track;
          return (
            <div
              key={s.id}
              class="shrink-0 w-80 snap-center border border-[#D9D9D9] rounded-xl overflow-hidden bg-white shadow cursor-pointer"
              onClick={() => {
                console.log(
                  `[Songfess] Opening modal for confession ID ${s.id}`
                );
                setModalIndex(i);
              }}
            >
              <div class="flex flex-col gap-4 w-full h-full p-4">
                {/* Recipient Label */}
                <div class="flex items-center px-3 bg-gray-100 border border-[#D9D9D9] w-fit rounded-full">
                  <p class="font-normal text-[11px] text-gray-950">To:</p>&nbsp;
                  <p class="font-semibold text-[11px] text-gray-950">
                    {s.recipient || "Secret"}
                  </p>
                </div>

                {/* Message Preview */}
                <div class="font-renie-beanie pb-1.5 text-2xl text-gray-950 sm:text-3xl">
                  {s.message.length > 120
                    ? s.message.slice(0, 120) + "…"
                    : s.message}
                </div>

                {/* Track Footer */}
                {track && (
                  <div class="flex items-center justify-between gap-2 p-4 border-t border-[#D9D9D9] bg-gray-100">
                    <div class="flex items-center gap-2 w-full">
                      <img
                        class="w-10 h-10 rounded object-cover shrink-0"
                        src={track.coverImage || "/icons/default-cover.png"}
                        alt={`${track.name} cover`}
                      />
                      <div class="flex flex-col gap-px">
                        <p class="font-semibold text-[13px] text-gray-950">
                          {track.name || "Unknown Track"}
                        </p>
                        <p class="font-normal text-[11px] text-gray-700">
                          {track.artist || "Unknown Artist"}
                        </p>
                      </div>
                    </div>
                    <a
                      rel="noreferrer noopener"
                      target="_blank"
                      href={track.url}
                    >
                      <svg
                        role="img"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-6 h-6 text-gray-700 hover:text-gray-900"
                      >
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/*  MODAL: Expanded message view                                      */}
      {/* =================================================================== */}
      {modalIndex !== null &&
        (() => {
          const s = songfesses[modalIndex];
          const track = s.track;
          console.log(`[Songfess] Rendering modal for message ID: ${s.id}`);
          return (
            <div class="fixed inset-0 bg-gray-800/90 flex items-center justify-center p-4 z-50">
              <div class="bg-white rounded-xl w-full max-w-lg p-6 relative">
                <button
                  class="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
                  onClick={() => {
                    console.log("[Songfess] Closing modal");
                    setModalIndex(null);
                  }}
                >
                  Close
                </button>
                <h3 class="text-xl font-semibold text-gray-900 mb-4">
                  Message to {s.recipient || "Secret"}
                </h3>
                <p class="text-gray-800 mb-6 whitespace-pre-wrap">
                  {s.message}
                </p>

                {/* Embedded Spotify Player */}
                {track?.embedUrl && (
                  <iframe
                    src={track.embedUrl}
                    width="100%"
                    height="152"
                    allow="encrypted-media"
                    class="rounded-lg border-none"
                  ></iframe>
                )}

                <div class="text-[10px] text-gray-500 mt-4">
                  {new Date(s.createdAt).toLocaleString("en-GB", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              </div>
            </div>
          );
        })()}
    </section>
  );
}
