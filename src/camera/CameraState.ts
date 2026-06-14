import { Matrix4, Quaternion, Vector3 } from "three";
import {
  CAMERA_START_ALTITUDE_METERS,
  PLANET_CENTER,
  PLANET_RADIUS_METERS,
} from "../world/WorldConstants";

export class CameraState {
  readonly realPosition: Vector3;
  readonly quaternion: Quaternion;
  readonly velocity: Vector3;
  readonly up: Vector3;
  yawRadians: number;
  pitchRadians: number;
  planetLockFactor = 1;
  speedMetersPerSecond = 0;

  constructor(
    realPosition: Vector3,
    quaternion: Quaternion,
    yawRadians = 0,
    pitchRadians = 0,
  ) {
    this.realPosition = realPosition.clone();
    this.quaternion = quaternion.clone();
    this.velocity = new Vector3();
    this.up = new Vector3(0, 1, 0).applyQuaternion(this.quaternion).normalize();
    this.yawRadians = yawRadians;
    this.pitchRadians = pitchRadians;
  }
}

export function getCameraModeLabel(state: CameraState): string {
  if (state.planetLockFactor >= 0.995) {
    return "Planet locked";
  }

  if (state.planetLockFactor <= 0.005) {
    return "Free space";
  }

  return "Transition blend";
}

export function createInitialCameraState(): CameraState {
  const surfaceNormal = new Vector3(0, 1, 0);
  const tangentForward = new Vector3(0, 0, -1);
  const planetCenter = new Vector3(
    PLANET_CENTER.x,
    PLANET_CENTER.y,
    PLANET_CENTER.z,
  );

  const realPosition = planetCenter.addScaledVector(
    surfaceNormal,
    PLANET_RADIUS_METERS + CAMERA_START_ALTITUDE_METERS,
  );

  const viewDirection = tangentForward
    .clone()
    .multiplyScalar(0.94)
    .addScaledVector(surfaceNormal, -0.34)
    .normalize();

  const lookMatrix = new Matrix4().lookAt(
    new Vector3(),
    viewDirection,
    surfaceNormal,
  );
  const quaternion = new Quaternion().setFromRotationMatrix(lookMatrix);
  const pitchRadians = Math.asin(viewDirection.dot(surfaceNormal));

  return new CameraState(realPosition, quaternion, 0, pitchRadians);
}
