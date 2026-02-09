

export const GenerationState = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  VIDEO_GENERATING: 'VIDEO_GENERATING', // New state for video specific loading
  PLAYING: 'PLAYING',
  ERROR: 'ERROR'
};

export const MetalTrackStructure = {}; // Placeholder if needed elsewhere
export const GenerationResult = {
  mediaUrl: String, // Can be image data URI or video download URI
  mediaType: String, // 'image' or 'video'
  trackStructure: MetalTrackStructure,
  prompt: String
};
export const HistoryItem = {}; // Placeholder if needed elsewhere
export const KernelConfig = {}; // Placeholder if needed elsewhere
