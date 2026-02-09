

export const GenerationState = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  PLAYING: 'PLAYING',
  ERROR: 'ERROR'
};

// The following are now exported as empty objects to satisfy runtime imports
// that might still be referencing these names after TypeScript interfaces were removed.
export const MetalTrackStructure = {};
export const GenerationResult = {};
export const HistoryItem = {};
export const KernelConfig = {};
