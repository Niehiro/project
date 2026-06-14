import {
  BufferGeometry,
  Material,
  Quaternion,
  Vector3,
} from "three";

export type ObjectCategory = "Basic Shapes" | "Structures" | "Markers";
export type ObjectLodLevel = 0 | 1 | 2;

export interface ObjectLodPart {
  geometry: BufferGeometry;
  material: Material;
  localPosition: Vector3;
  localRotation: Quaternion;
  localScale: Vector3;
}

export interface ObjectLodSettings {
  nearDistanceMeters: number;
  midDistanceMeters: number;
  farDistanceMeters: number;
  canDisappearWhenSmall: boolean;
  keepVisibleWhenLarge: boolean;
}

export interface ObjectDefinition {
  definitionId: string;
  modelId: string;
  name: string;
  category: ObjectCategory;
  description: string;
  defaultScale: number;
  minScale: number;
  color: string;
  accentColor?: string;
  supportsInstancing: boolean;
  approximateBoundsRadiusMeters: number;
  selectionRadiusMeters: number;
  baseHeightMeters: number;
  lod: Record<ObjectLodLevel, ObjectLodPart[]>;
  lodSettings: ObjectLodSettings;
}

export function sanitizeObjectScale(
  definition: ObjectDefinition,
  scale: number,
): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return definition.defaultScale;
  }

  return Math.max(definition.minScale, scale);
}
