export interface FrameStats {
  fps: number;
  frameTimeMs: number;
}

export interface QualityState {
  renderScale: number;
  maxActiveChunks: number;
  maxChunkGenerationsPerFrame: number;
  maxChunkGenerationTimeMs: number;
  chunkResolution: number;
  maxGenerationQueueLength: number;
  maxCachedChunks: number;
}
