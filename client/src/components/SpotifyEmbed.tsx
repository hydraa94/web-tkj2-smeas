// src/components/SpotifyEmbed.tsx
import { useEffect, useRef } from "preact/hooks";

interface SpotifyEmbedProps {
  uri: string;
  width?: string;
  height?: string;
}

export default function SpotifyEmbed({
  uri,
  width = "100%",
  height = "152",
}: SpotifyEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<any>(null);

  useEffect(() => {
    window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
      if (containerRef.current) {
        const options = { width, height, uri };
        IFrameAPI.createController(
          containerRef.current,
          options,
          (EmbedController: any) => {
            controllerRef.current = EmbedController;
          }
        );
      }
    };
  }, [width, height, uri]);

  useEffect(() => {
    if (controllerRef.current && uri) {
      controllerRef.current.loadUri(uri);
    }
  }, [uri]);

  return <div ref={containerRef} />;
}
