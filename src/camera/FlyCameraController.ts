import { Matrix4, Quaternion, Vector2, Vector3 } from "three";
import { Input } from "../core/Input";
import {
  CAMERA_GROUND_SPEED_ALTITUDE_METERS,
  CAMERA_HIGH_ATMOSPHERE_SPEED_ALTITUDE_METERS,
  CAMERA_HIGH_ATMOSPHERE_SPEED_MPS,
  CAMERA_LOW_ATMOSPHERE_SPEED_ALTITUDE_METERS,
  CAMERA_LOW_ATMOSPHERE_SPEED_MPS,
  CAMERA_MAX_SPACE_SPEED_MPS,
  CAMERA_MIN_SPEED_MPS,
  CAMERA_SPACE_SPEED_ALTITUDE_FACTOR,
  CAMERA_SURFACE_SPEED_MPS,
  ORBIT_MODE_MIN_ALTITUDE_METERS,
  PLANET_CENTER,
  PLANET_RADIUS_METERS,
  SURFACE_MODE_MAX_ALTITUDE_METERS,
} from "../world/WorldConstants";
import { CameraState } from "./CameraState";

const LOOK_SENSITIVITY = 0.0022;
const ACCELERATION_RESPONSE = 5.8;
const DECELERATION_RESPONSE = 4.2;
const MIN_SPEED_MULTIPLIER = 0.25;
const MAX_SPEED_MULTIPLIER = 18;
const MIN_PITCH_RADIANS = (-45 * Math.PI) / 180;
const MAX_PITCH_RADIANS = (35 * Math.PI) / 180;
const HORIZON_EPSILON = 0.0001;

export class FlyCameraController {
  private readonly lookDelta = new Vector2();
  private readonly moveIntent = new Vector3();
  private readonly targetVelocity = new Vector3();
  private readonly forward = new Vector3();
  private readonly forwardOnHorizon = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly cameraUp = new Vector3();
  private readonly movementUp = new Vector3();
  private readonly lookUpAxis = new Vector3();
  private readonly planetCenter = new Vector3(
    PLANET_CENTER.x,
    PLANET_CENTER.y,
    PLANET_CENTER.z,
  );
  private readonly finalForward = new Vector3();
  private readonly freeQuaternion = new Quaternion();
  private readonly lockedQuaternion = new Quaternion();
  private readonly yawQuaternion = new Quaternion();
  private readonly pitchQuaternion = new Quaternion();
  private readonly lookMatrix = new Matrix4();
  private readonly lookOrigin = new Vector3();
  private readonly fallbackReference = new Vector3();
  private speedMultiplier = 1;

  update(
    state: CameraState,
    input: Input,
    altitudeMeters: number,
    deltaSeconds: number,
  ): void {
    let planetLockFactor = getPlanetLockFactor(altitudeMeters);
    state.planetLockFactor = planetLockFactor;

    this.updateLook(state, input, planetLockFactor);
    this.updateSpeedMultiplier(input);
    this.updateMovement(
      state,
      input,
      altitudeMeters,
      deltaSeconds,
      planetLockFactor,
    );
    planetLockFactor = getPlanetLockFactor(this.getCurrentAltitudeMeters(state));
    state.planetLockFactor = planetLockFactor;
    this.rebuildBlendedOrientation(state, 0, 0, planetLockFactor);
  }

  private updateLook(
    state: CameraState,
    input: Input,
    planetLockFactor: number,
  ): void {
    input.consumeLookDelta(this.lookDelta);
    const yawDelta = -this.lookDelta.x * LOOK_SENSITIVITY;
    const pitchDelta = -this.lookDelta.y * LOOK_SENSITIVITY;
    this.rebuildBlendedOrientation(state, yawDelta, pitchDelta, planetLockFactor);
  }

  private rebuildBlendedOrientation(
    state: CameraState,
    yawDelta: number,
    pitchDelta: number,
    planetLockFactor: number,
  ): void {
    state.yawRadians += yawDelta;

    this.up.copy(state.realPosition).sub(this.planetCenter).normalize();
    this.cameraUp.set(0, 1, 0).applyQuaternion(state.quaternion).normalize();
    this.getBlendedUpAxis(
      this.cameraUp,
      this.up,
      planetLockFactor,
      this.lookUpAxis,
    );

    this.freeQuaternion.copy(state.quaternion);
    if (Math.abs(yawDelta) > 0) {
      this.yawQuaternion.setFromAxisAngle(this.lookUpAxis, yawDelta);
      this.freeQuaternion.premultiply(this.yawQuaternion);
    }

    if (Math.abs(pitchDelta) > 0) {
      this.right.set(1, 0, 0).applyQuaternion(this.freeQuaternion).normalize();
      this.pitchQuaternion.setFromAxisAngle(this.right, pitchDelta);
      this.freeQuaternion.premultiply(this.pitchQuaternion);
    }
    this.freeQuaternion.normalize();

    if (planetLockFactor <= 0) {
      state.quaternion.copy(this.freeQuaternion);
      this.updateCameraUp(state);
      return;
    }

    this.forward.set(0, 0, -1).applyQuaternion(this.freeQuaternion).normalize();
    this.projectForwardToHorizon(this.forward, this.up, this.forwardOnHorizon);

    this.right
      .crossVectors(this.forwardOnHorizon, this.up)
      .normalize();
    this.forwardOnHorizon
      .crossVectors(this.up, this.right)
      .normalize();

    state.pitchRadians = clamp(
      Math.asin(clamp(this.forward.dot(this.up), -1, 1)),
      MIN_PITCH_RADIANS,
      MAX_PITCH_RADIANS,
    );

    this.finalForward
      .copy(this.forwardOnHorizon)
      .multiplyScalar(Math.cos(state.pitchRadians))
      .addScaledVector(this.up, Math.sin(state.pitchRadians))
      .normalize();

    this.lookMatrix.lookAt(this.lookOrigin, this.finalForward, this.up);
    this.lockedQuaternion.setFromRotationMatrix(this.lookMatrix).normalize();
    state.quaternion
      .copy(this.freeQuaternion)
      .slerp(this.lockedQuaternion, planetLockFactor)
      .normalize();
    this.updateCameraUp(state);
  }

  private updateSpeedMultiplier(input: Input): void {
    const wheelDelta = input.consumeWheelDelta();
    if (wheelDelta === 0) {
      return;
    }

    this.speedMultiplier *= Math.exp(-wheelDelta * 0.001);
    this.speedMultiplier = Math.min(
      MAX_SPEED_MULTIPLIER,
      Math.max(MIN_SPEED_MULTIPLIER, this.speedMultiplier),
    );
  }

  private updateMovement(
    state: CameraState,
    input: Input,
    altitudeMeters: number,
    deltaSeconds: number,
    planetLockFactor: number,
  ): void {
    input.getMoveIntent(this.moveIntent);

    this.forward.set(0, 0, -1).applyQuaternion(state.quaternion).normalize();
    this.right.set(1, 0, 0).applyQuaternion(state.quaternion).normalize();
    this.up.copy(state.realPosition).sub(this.planetCenter).normalize();
    this.cameraUp.set(0, 1, 0).applyQuaternion(state.quaternion).normalize();
    this.getBlendedUpAxis(
      this.cameraUp,
      this.up,
      planetLockFactor,
      this.movementUp,
    );

    const baseSpeed = this.getAltitudeSpeed(altitudeMeters) * this.speedMultiplier;
    const boostMultiplier = input.isBoosting() ? 4 : 1;
    const speed = Math.min(
      CAMERA_MAX_SPACE_SPEED_MPS,
      baseSpeed * boostMultiplier,
    );

    this.targetVelocity.set(0, 0, 0);
    this.targetVelocity.addScaledVector(this.right, this.moveIntent.x);
    this.targetVelocity.addScaledVector(this.forward, this.moveIntent.z);
    this.targetVelocity.addScaledVector(this.movementUp, this.moveIntent.y);

    if (this.targetVelocity.lengthSq() > 0) {
      this.targetVelocity.normalize().multiplyScalar(speed);
    }

    const response =
      this.targetVelocity.lengthSq() > 0
        ? ACCELERATION_RESPONSE
        : DECELERATION_RESPONSE;
    const blend = 1 - Math.exp(-response * deltaSeconds);
    state.velocity.lerp(this.targetVelocity, blend);

    state.realPosition.addScaledVector(state.velocity, deltaSeconds);
    state.speedMetersPerSecond = state.velocity.length();
  }

  private getAltitudeSpeed(altitudeMeters: number): number {
    if (altitudeMeters < CAMERA_GROUND_SPEED_ALTITUDE_METERS) {
      return this.lerp(
        CAMERA_MIN_SPEED_MPS,
        CAMERA_SURFACE_SPEED_MPS,
        altitudeMeters / CAMERA_GROUND_SPEED_ALTITUDE_METERS,
      );
    }

    if (altitudeMeters < CAMERA_LOW_ATMOSPHERE_SPEED_ALTITUDE_METERS) {
      return this.lerp(
        CAMERA_SURFACE_SPEED_MPS,
        CAMERA_LOW_ATMOSPHERE_SPEED_MPS,
        (altitudeMeters - CAMERA_GROUND_SPEED_ALTITUDE_METERS) /
          (CAMERA_LOW_ATMOSPHERE_SPEED_ALTITUDE_METERS -
            CAMERA_GROUND_SPEED_ALTITUDE_METERS),
      );
    }

    if (altitudeMeters < CAMERA_HIGH_ATMOSPHERE_SPEED_ALTITUDE_METERS) {
      return this.lerp(
        CAMERA_LOW_ATMOSPHERE_SPEED_MPS,
        CAMERA_HIGH_ATMOSPHERE_SPEED_MPS,
        (altitudeMeters - CAMERA_LOW_ATMOSPHERE_SPEED_ALTITUDE_METERS) /
          (CAMERA_HIGH_ATMOSPHERE_SPEED_ALTITUDE_METERS -
            CAMERA_LOW_ATMOSPHERE_SPEED_ALTITUDE_METERS),
      );
    }

    return Math.min(
      CAMERA_MAX_SPACE_SPEED_MPS,
      CAMERA_HIGH_ATMOSPHERE_SPEED_MPS +
        (altitudeMeters - CAMERA_HIGH_ATMOSPHERE_SPEED_ALTITUDE_METERS) *
          CAMERA_SPACE_SPEED_ALTITUDE_FACTOR,
    );
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }

  private projectForwardToHorizon(
    forward: Vector3,
    localUp: Vector3,
    target: Vector3,
  ): Vector3 {
    target.copy(forward).addScaledVector(localUp, -forward.dot(localUp));

    if (target.lengthSq() > HORIZON_EPSILON) {
      return target.normalize();
    }

    this.getFallbackTangent(localUp, target);
    return target;
  }

  private getFallbackTangent(localUp: Vector3, target: Vector3): Vector3 {
    if (Math.abs(localUp.dot(this.fallbackReference.set(0, 0, -1))) > 0.95) {
      this.fallbackReference.set(1, 0, 0);
    }

    return target
      .copy(this.fallbackReference)
      .addScaledVector(localUp, -this.fallbackReference.dot(localUp))
      .normalize();
  }

  private updateCameraUp(state: CameraState): void {
    state.up.set(0, 1, 0).applyQuaternion(state.quaternion).normalize();
  }

  private getBlendedUpAxis(
    cameraUp: Vector3,
    localUp: Vector3,
    planetLockFactor: number,
    target: Vector3,
  ): Vector3 {
    target.copy(cameraUp).lerp(localUp, planetLockFactor);

    if (target.lengthSq() > HORIZON_EPSILON) {
      return target.normalize();
    }

    return target.copy(planetLockFactor >= 0.5 ? localUp : cameraUp).normalize();
  }

  private getCurrentAltitudeMeters(state: CameraState): number {
    return state.realPosition.distanceTo(this.planetCenter) - PLANET_RADIUS_METERS;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPlanetLockFactor(altitudeMeters: number): number {
  return (
    1 -
    smoothstep(
      SURFACE_MODE_MAX_ALTITUDE_METERS,
      ORBIT_MODE_MIN_ALTITUDE_METERS,
      altitudeMeters,
    )
  );
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
