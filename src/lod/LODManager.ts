import { LOD_LEVELS, LODLevelSettings } from "./LODSettings";
import {
  ORBIT_MODE_MIN_ALTITUDE_METERS,
  SURFACE_MODE_MAX_ALTITUDE_METERS,
  WorldMode,
} from "../world/WorldConstants";

export class LODManager {
  getMode(altitudeMeters: number): WorldMode {
    if (altitudeMeters < SURFACE_MODE_MAX_ALTITUDE_METERS) {
      return "surface";
    }

    if (altitudeMeters < ORBIT_MODE_MIN_ALTITUDE_METERS) {
      return "transition";
    }

    return "orbit";
  }

  getLOD(altitudeMeters: number): LODLevelSettings {
    return (
      LOD_LEVELS.find(
        (level) =>
          altitudeMeters >= level.minAltitudeMeters &&
          altitudeMeters < level.maxAltitudeMeters,
      ) ?? LOD_LEVELS[LOD_LEVELS.length - 1]
    );
  }
}
