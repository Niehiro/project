import { Vector3 } from "three";
import { WorldMode } from "../world/WorldConstants";

export interface PlanetRenderer {
  update(
    localPlanetCenter: Vector3,
    mode: WorldMode,
    enabled?: boolean,
  ): void;
}
