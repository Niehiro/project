export class RenderLayerDebugState {
  surfaceEnabled = true;
  orbitEnabled = true;
  atmosphereEnabled = true;

  toggleSurface(): void {
    this.surfaceEnabled = !this.surfaceEnabled;
  }

  toggleOrbit(): void {
    this.orbitEnabled = !this.orbitEnabled;
  }

  toggleAtmosphere(): void {
    this.atmosphereEnabled = !this.atmosphereEnabled;
  }
}
