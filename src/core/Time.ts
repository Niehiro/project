export class Time {
  private lastTime = performance.now();

  deltaSeconds = 0;
  elapsedSeconds = 0;

  tick(): number {
    const now = performance.now();
    this.deltaSeconds = Math.min((now - this.lastTime) / 1000, 0.1);
    this.elapsedSeconds += this.deltaSeconds;
    this.lastTime = now;
    return this.deltaSeconds;
  }
}
