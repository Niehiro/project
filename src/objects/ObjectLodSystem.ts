import { Vector3 } from "three";
import {
  PLANET_RADIUS_METERS,
  TERRAIN_BASE_CHUNKS_PER_FACE,
} from "../world/WorldConstants";
import { ObjectDefinition, ObjectLodLevel } from "./ObjectDefinition";
import { ObjectInstance } from "./ObjectInstance";

export interface ObjectLodDecision {
  lodLevel: ObjectLodLevel | null;
  distanceMeters: number;
  chunkDistance: number;
  approximateWorldSizeMeters: number;
  largeFarKept: boolean;
}

const OBJECT_CHUNK_DISTANCE_METERS =
  (PLANET_RADIUS_METERS * Math.PI * 0.5) / TERRAIN_BASE_CHUNKS_PER_FACE;

const LARGE_OBJECT_WORLD_SIZE_METERS = 120;
const HUGE_OBJECT_WORLD_SIZE_METERS = 1_000;
const SELECTED_OBJECT_EXTRA_DISTANCE_METERS = OBJECT_CHUNK_DISTANCE_METERS * 8;
const LOD_HYSTERESIS_FACTOR = 1.15;

export class ObjectLodSystem {
  decide(
    instance: ObjectInstance,
    definition: ObjectDefinition,
    cameraRealPosition: Vector3,
    selected: boolean,
  ): ObjectLodDecision {
    const distanceMeters = instance.realPosition.distanceTo(cameraRealPosition);
    const approximateWorldSizeMeters = instance.approximateWorldSizeMeters;
    const chunkDistance = distanceMeters / OBJECT_CHUNK_DISTANCE_METERS;

    if (!instance.state.visible) {
      return {
        lodLevel: null,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: false,
      };
    }

    if (instance.lodOverride !== null) {
      return {
        lodLevel: instance.lodOverride,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: false,
      };
    }

    const sizeBoost = Math.max(0, approximateWorldSizeMeters * 0.65);
    const selectedBoost = selected ? SELECTED_OBJECT_EXTRA_DISTANCE_METERS : 0;
    const nearDistance =
      definition.lodSettings.nearDistanceMeters + sizeBoost * 0.35 + selectedBoost;
    const midDistance =
      definition.lodSettings.midDistanceMeters + sizeBoost * 1.2 + selectedBoost;
    const farDistance =
      definition.lodSettings.farDistanceMeters + sizeBoost * 5 + selectedBoost;
    const isLarge =
      approximateWorldSizeMeters >= LARGE_OBJECT_WORLD_SIZE_METERS ||
      !definition.lodSettings.canDisappearWhenSmall;
    const isHuge = approximateWorldSizeMeters >= HUGE_OBJECT_WORLD_SIZE_METERS;
    const largeFarDistance = isHuge
      ? Math.max(farDistance, approximateWorldSizeMeters * 40)
      : Math.max(farDistance, approximateWorldSizeMeters * 14);

    if (
      instance.currentLodLevel === 0 &&
      distanceMeters <= nearDistance * LOD_HYSTERESIS_FACTOR
    ) {
      return {
        lodLevel: 0,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: false,
      };
    }

    if (
      instance.currentLodLevel === 1 &&
      distanceMeters > nearDistance / LOD_HYSTERESIS_FACTOR &&
      distanceMeters <= midDistance * LOD_HYSTERESIS_FACTOR
    ) {
      return {
        lodLevel: 1,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: false,
      };
    }

    if (
      instance.currentLodLevel === 2 &&
      definition.lodSettings.keepVisibleWhenLarge &&
      isLarge &&
      distanceMeters > midDistance / LOD_HYSTERESIS_FACTOR &&
      distanceMeters <= largeFarDistance * LOD_HYSTERESIS_FACTOR
    ) {
      return {
        lodLevel: 2,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: true,
      };
    }

    if (distanceMeters <= nearDistance) {
      return {
        lodLevel: 0,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: false,
      };
    }

    if (distanceMeters <= midDistance) {
      return {
        lodLevel: 1,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: false,
      };
    }

    if (
      definition.lodSettings.keepVisibleWhenLarge &&
      isLarge &&
      distanceMeters <= largeFarDistance
    ) {
      return {
        lodLevel: 2,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: true,
      };
    }

    if (!definition.lodSettings.canDisappearWhenSmall && distanceMeters <= farDistance) {
      return {
        lodLevel: 2,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: true,
      };
    }

    return {
      lodLevel: null,
      distanceMeters,
      chunkDistance,
      approximateWorldSizeMeters,
      largeFarKept: false,
    };
  }
}
