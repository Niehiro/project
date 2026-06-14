import { Color, Scene } from "three";
import {
  ORBIT_MODE_MIN_ALTITUDE_METERS,
  SURFACE_MODE_MAX_ALTITUDE_METERS,
} from "../world/WorldConstants";

const lowSky = new Color("#dfeaf0");
const highSky = new Color("#516173");
const nearSpace = new Color("#111827");
const space = new Color("#04060b");

export class SkyController {
  private readonly current = new Color();

  constructor(private readonly scene: Scene) {}

  update(altitudeMeters: number): void {
    if (altitudeMeters < SURFACE_MODE_MAX_ALTITUDE_METERS) {
      const t = smoothstep(0, SURFACE_MODE_MAX_ALTITUDE_METERS, altitudeMeters);
      this.current.copy(lowSky).lerp(highSky, t);
    } else if (altitudeMeters < ORBIT_MODE_MIN_ALTITUDE_METERS) {
      const t = smoothstep(
        SURFACE_MODE_MAX_ALTITUDE_METERS,
        ORBIT_MODE_MIN_ALTITUDE_METERS,
        altitudeMeters,
      );
      this.current.copy(highSky).lerp(nearSpace, t);
    } else {
      const t = smoothstep(
        ORBIT_MODE_MIN_ALTITUDE_METERS,
        ORBIT_MODE_MIN_ALTITUDE_METERS * 2.4,
        altitudeMeters,
      );
      this.current.copy(nearSpace).lerp(space, t);
    }

    this.scene.background = this.current;
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
