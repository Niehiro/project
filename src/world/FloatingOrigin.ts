import { Vector3 } from "three";
import {
  FLOATING_ORIGIN_REBASE_DISTANCE_METERS,
  PLANET_CENTER,
} from "./WorldConstants";

export class FloatingOrigin {
  readonly origin = new Vector3();
  private readonly rebaseDistanceSq =
    FLOATING_ORIGIN_REBASE_DISTANCE_METERS *
    FLOATING_ORIGIN_REBASE_DISTANCE_METERS;

  rebaseCount = 0;

  constructor(initialCameraRealPosition: Vector3) {
    this.origin.copy(initialCameraRealPosition);
  }

  update(cameraRealPosition: Vector3): boolean {
    if (cameraRealPosition.distanceToSquared(this.origin) <= this.rebaseDistanceSq) {
      return false;
    }

    this.origin.copy(cameraRealPosition);
    this.rebaseCount += 1;
    return true;
  }

  toLocal(realPosition: Vector3, target = new Vector3()): Vector3 {
    return target.copy(realPosition).sub(this.origin);
  }

  getLocalPlanetCenter(target = new Vector3()): Vector3 {
    return target.set(PLANET_CENTER.x, PLANET_CENTER.y, PLANET_CENTER.z).sub(this.origin);
  }
}
