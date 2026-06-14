import { Vector3 } from "three";
import { getZoneIdFromPosition } from "./ZoneMath";
import { ZoneId } from "./ZoneId";

export class ZoneManager {
  currentZoneId: ZoneId = "face_0_x_0_y_0";

  update(realPosition: Vector3): ZoneId {
    this.currentZoneId = getZoneIdFromPosition(realPosition);
    return this.currentZoneId;
  }
}
