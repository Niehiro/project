import { FrameStats } from "./FrameStats";

export class PerformanceMonitor {
  private accumulatorSeconds = 0;
  private frameCount = 0;
  private frameTimeSumMs = 0;

  readonly stats: FrameStats = {
    fps: 60,
    frameTimeMs: 16.67,
  };

  update(deltaSeconds: number): FrameStats {
    this.accumulatorSeconds += deltaSeconds;
    this.frameCount += 1;
    this.frameTimeSumMs += deltaSeconds * 1000;

    if (this.accumulatorSeconds >= 0.5) {
      this.stats.fps = this.frameCount / this.accumulatorSeconds;
      this.stats.frameTimeMs = this.frameTimeSumMs / this.frameCount;
      this.accumulatorSeconds = 0;
      this.frameCount = 0;
      this.frameTimeSumMs = 0;
    }

    return this.stats;
  }
}
