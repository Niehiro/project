import { Vector3 } from "three";
import {
  PLANET_RADIUS_METERS,
  TERRAIN_BASE_CHUNKS_PER_FACE,
} from "../world/WorldConstants";
import { ObjectDefinition, ObjectLodLevel } from "./ObjectDefinition";
import { ObjectInstance } from "./ObjectInstance";

export interface ObjectLodDecision {
  lodLevel: ObjectLodLevel | null;
  chunkLodType: ObjectChunkLodType;
  distanceMeters: number;
  chunkDistance: number;
  approximateWorldSizeMeters: number;
  largeFarKept: boolean;
  proxyVisible: boolean;
}

export type ObjectChunkLodType = "type1" | "type2" | "type3" | "type4";

const OBJECT_CHUNK_DISTANCE_METERS =
  (PLANET_RADIUS_METERS * Math.PI * 0.5) / TERRAIN_BASE_CHUNKS_PER_FACE;

const LARGE_OBJECT_WORLD_SIZE_METERS = 120;
const HUGE_OBJECT_WORLD_SIZE_METERS = 1_000;
const SELECTED_OBJECT_EXTRA_DISTANCE_METERS = OBJECT_CHUNK_DISTANCE_METERS * 8;
const LOD_HYSTERESIS_FACTOR = 1.15;
const TYPE1_MAX_CHUNK_DISTANCE = 4;
const TYPE2_MAX_CHUNK_DISTANCE = 12;
const TYPE3_MAX_CHUNK_DISTANCE = 32;

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
    const effectiveChunkDistance = selected
      ? Math.max(
          0,
          chunkDistance -
            SELECTED_OBJECT_EXTRA_DISTANCE_METERS / OBJECT_CHUNK_DISTANCE_METERS,
        )
      : chunkDistance;
    const chunkLodType = getObjectChunkLodType(
      effectiveChunkDistance,
      instance.currentLodLevel,
    );

    if (!instance.state.visible) {
      return {
        lodLevel: null,
        chunkLodType,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: false,
        proxyVisible: false,
      };
    }

    if (instance.lodOverride !== null) {
      return {
        lodLevel: instance.lodOverride,
        chunkLodType,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        largeFarKept: false,
        proxyVisible: chunkLodType === "type4" && instance.lodOverride === 2,
      };
    }

    const isLarge =
      approximateWorldSizeMeters >= LARGE_OBJECT_WORLD_SIZE_METERS ||
      !definition.lodSettings.canDisappearWhenSmall;
    const isHuge = approximateWorldSizeMeters >= HUGE_OBJECT_WORLD_SIZE_METERS;
    const keepLargeVisible =
      isHuge || (definition.lodSettings.keepVisibleWhenLarge && isLarge);
    const proxyVisible =
      selected ||
      keepLargeVisible ||
      (!definition.lodSettings.canDisappearWhenSmall && chunkLodType !== "type4");

    if (chunkLodType === "type1") {
      return createDecision(0, chunkLodType, distanceMeters, chunkDistance, approximateWorldSizeMeters);
    }

    if (chunkLodType === "type2") {
      return createDecision(1, chunkLodType, distanceMeters, chunkDistance, approximateWorldSizeMeters);
    }

    if (chunkLodType === "type3") {
      if (!proxyVisible && definition.lodSettings.canDisappearWhenSmall) {
        return createDecision(null, chunkLodType, distanceMeters, chunkDistance, approximateWorldSizeMeters);
      }

      return createDecision(
        2,
        chunkLodType,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        keepLargeVisible || !definition.lodSettings.canDisappearWhenSmall,
        true,
      );
    }

    if (proxyVisible && (keepLargeVisible || selected)) {
      return createDecision(
        2,
        chunkLodType,
        distanceMeters,
        chunkDistance,
        approximateWorldSizeMeters,
        keepLargeVisible,
        true,
      );
    }

    return createDecision(
      null,
      chunkLodType,
      distanceMeters,
      chunkDistance,
      approximateWorldSizeMeters,
    );
  }
}

function createDecision(
  lodLevel: ObjectLodLevel | null,
  chunkLodType: ObjectChunkLodType,
  distanceMeters: number,
  chunkDistance: number,
  approximateWorldSizeMeters: number,
  largeFarKept = false,
  proxyVisible = false,
): ObjectLodDecision {
  return {
    lodLevel,
    chunkLodType,
    distanceMeters,
    chunkDistance,
    approximateWorldSizeMeters,
    largeFarKept,
    proxyVisible,
  };
}

function getObjectChunkLodType(
  chunkDistance: number,
  currentLodLevel: ObjectLodLevel | null,
): ObjectChunkLodType {
  if (
    currentLodLevel === 0 &&
    chunkDistance <= TYPE1_MAX_CHUNK_DISTANCE * LOD_HYSTERESIS_FACTOR
  ) {
    return "type1";
  }

  if (
    currentLodLevel === 1 &&
    chunkDistance > TYPE1_MAX_CHUNK_DISTANCE / LOD_HYSTERESIS_FACTOR &&
    chunkDistance <= TYPE2_MAX_CHUNK_DISTANCE * LOD_HYSTERESIS_FACTOR
  ) {
    return "type2";
  }

  if (
    currentLodLevel === 2 &&
    chunkDistance > TYPE2_MAX_CHUNK_DISTANCE / LOD_HYSTERESIS_FACTOR &&
    chunkDistance <= TYPE3_MAX_CHUNK_DISTANCE * LOD_HYSTERESIS_FACTOR
  ) {
    return "type3";
  }

  if (chunkDistance <= TYPE1_MAX_CHUNK_DISTANCE) {
    return "type1";
  }

  if (chunkDistance <= TYPE2_MAX_CHUNK_DISTANCE) {
    return "type2";
  }

  if (chunkDistance <= TYPE3_MAX_CHUNK_DISTANCE) {
    return "type3";
  }

  return "type4";
}
