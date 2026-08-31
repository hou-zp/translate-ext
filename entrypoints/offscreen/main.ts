import { onOffscreenMessage } from '../../src/core/messaging';
import { detectTextRegions } from '../../src/core/manga-detector';

// Offscreen document (Chromium): hosts local ONNX inference so the service
// worker never has to load the wasm runtime.
onOffscreenMessage({
  detectTextRegions: ({ dataUrl, modelUrl }) => detectTextRegions(dataUrl, modelUrl),
});
