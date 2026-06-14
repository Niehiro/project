import { Quaternion, Vector3 } from "three";
import { ZoneId } from "../zones/ZoneId";
import { ObjectLodLevel } from "./ObjectDefinition";
import { ObjectInstanceState } from "./ObjectState";

export interface ObjectInstance {
  instanceId: string;
  definitionId: string;
  realPosition: Vector3;
  localPosition: Vector3;
  rotation: Quaternion;
  scale: number;
  state: ObjectInstanceState;
  currentLodLevel: ObjectLodLevel | null;
  surfaceYawRadians: number;
  approximateWorldSizeMeters: number;
  zoneId: ZoneId;
  lodOverride: ObjectLodLevel | null;
  createdAt: number;
  updatedAt: number;
}
