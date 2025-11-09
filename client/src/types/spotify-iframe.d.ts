interface IFrameAPI {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: any) => void
  ) => void;
}

interface Window {
  onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
}
