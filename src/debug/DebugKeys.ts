import { DebugOverlay } from "./DebugOverlay";
import { RenderLayerDebugState } from "./RenderLayerDebugState";

export class DebugKeys {
  constructor(
    private readonly overlay: DebugOverlay,
    private readonly layerDebug: RenderLayerDebugState,
  ) {
    window.addEventListener("keydown", (event) => {
      if (event.code === "F3") {
        event.preventDefault();
        this.overlay.toggle();
      }

      if (event.code === "F4") {
        event.preventDefault();
        this.layerDebug.toggleSurface();
      }

      if (event.code === "F5") {
        event.preventDefault();
        this.layerDebug.toggleOrbit();
      }

      if (event.code === "F6") {
        event.preventDefault();
        this.layerDebug.toggleAtmosphere();
      }
    });
  }
}
