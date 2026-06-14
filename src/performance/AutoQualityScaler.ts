import {
  DEFAULT_CHUNK_RESOLUTION,
  DEFAULT_MAX_CACHED_CHUNKS,
  DEFAULT_MAX_CHUNK_GENERATION_TIME_MS,
  DEFAULT_MAX_GENERATION_QUEUE_LENGTH,
  DEFAULT_MAX_ACTIVE_CHUNKS,
  DEFAULT_MAX_CHUNK_GENERATIONS_PER_FRAME,
  DEFAULT_RENDER_SCALE,
  MAX_RENDER_SCALE,
  MIN_RENDER_SCALE,
  MIN_ACTIVE_CHUNKS,
  MIN_CACHED_CHUNKS,
  MIN_CHUNK_GENERATION_TIME_MS,
  MIN_CHUNK_GENERATIONS_PER_FRAME,
  MIN_CHUNK_RESOLUTION,
} from "../world/WorldConstants";
import { FrameStats, QualityState } from "./FrameStats";

export class AutoQualityScaler {
  readonly quality: QualityState = {
    renderScale: DEFAULT_RENDER_SCALE,
    maxActiveChunks: DEFAULT_MAX_ACTIVE_CHUNKS,
    maxChunkGenerationsPerFrame: DEFAULT_MAX_CHUNK_GENERATIONS_PER_FRAME,
    maxChunkGenerationTimeMs: DEFAULT_MAX_CHUNK_GENERATION_TIME_MS,
    chunkResolution: DEFAULT_CHUNK_RESOLUTION,
    maxGenerationQueueLength: DEFAULT_MAX_GENERATION_QUEUE_LENGTH,
    maxCachedChunks: DEFAULT_MAX_CACHED_CHUNKS,
  };

  private elapsedSinceAdjustment = 0;

  update(stats: FrameStats, deltaSeconds: number): QualityState {
    this.elapsedSinceAdjustment += deltaSeconds;
    if (this.elapsedSinceAdjustment < 1) {
      return this.quality;
    }

    this.elapsedSinceAdjustment = 0;

    if (stats.fps < 20) {
      this.quality.renderScale = Math.max(
        MIN_RENDER_SCALE,
        this.quality.renderScale - 0.12,
      );
      this.quality.maxActiveChunks = Math.max(
        MIN_ACTIVE_CHUNKS,
        this.quality.maxActiveChunks - 32,
      );
      this.quality.maxChunkGenerationsPerFrame = Math.max(
        MIN_CHUNK_GENERATIONS_PER_FRAME,
        this.quality.maxChunkGenerationsPerFrame - 1,
      );
      this.quality.maxChunkGenerationTimeMs = Math.max(
        MIN_CHUNK_GENERATION_TIME_MS,
        this.quality.maxChunkGenerationTimeMs - 1,
      );
      this.quality.chunkResolution = Math.max(
        MIN_CHUNK_RESOLUTION,
        this.quality.chunkResolution - 8,
      );
      this.quality.maxCachedChunks = Math.max(
        MIN_CACHED_CHUNKS,
        this.quality.maxCachedChunks - 8,
      );
      return this.quality;
    }

    if (stats.fps < 30) {
      this.quality.renderScale = Math.max(
        MIN_RENDER_SCALE,
        this.quality.renderScale - 0.08,
      );
      this.quality.maxActiveChunks = Math.max(
        MIN_ACTIVE_CHUNKS,
        this.quality.maxActiveChunks - 18,
      );
      this.quality.chunkResolution = Math.max(
        MIN_CHUNK_RESOLUTION,
        this.quality.chunkResolution - 4,
      );
      this.quality.maxCachedChunks = Math.max(
        MIN_CACHED_CHUNKS,
        this.quality.maxCachedChunks - 4,
      );
      return this.quality;
    }

    if (stats.fps < 50) {
      this.quality.renderScale = Math.max(
        0.85,
        this.quality.renderScale - 0.025,
      );
      this.quality.maxActiveChunks = Math.max(
        180,
        this.quality.maxActiveChunks - 8,
      );
      return this.quality;
    }

    this.quality.renderScale = Math.min(
      MAX_RENDER_SCALE,
      this.quality.renderScale + 0.015,
    );
    this.quality.maxActiveChunks = Math.min(
      DEFAULT_MAX_ACTIVE_CHUNKS,
      this.quality.maxActiveChunks + 6,
    );
    this.quality.maxChunkGenerationsPerFrame = Math.min(
      DEFAULT_MAX_CHUNK_GENERATIONS_PER_FRAME,
      this.quality.maxChunkGenerationsPerFrame + 1,
    );
    this.quality.maxChunkGenerationTimeMs = Math.min(
      DEFAULT_MAX_CHUNK_GENERATION_TIME_MS,
      this.quality.maxChunkGenerationTimeMs + 0.5,
    );
    this.quality.chunkResolution = Math.min(
      DEFAULT_CHUNK_RESOLUTION,
      this.quality.chunkResolution + 2,
    );
    this.quality.maxCachedChunks = Math.min(
      DEFAULT_MAX_CACHED_CHUNKS,
      this.quality.maxCachedChunks + 2,
    );

    return this.quality;
  }
}
