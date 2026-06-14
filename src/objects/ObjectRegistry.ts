import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import {
  PLANET_RADIUS_METERS,
  TERRAIN_BASE_CHUNKS_PER_FACE,
} from "../world/WorldConstants";
import {
  ObjectDefinition,
  ObjectLodLevel,
  ObjectLodPart,
  ObjectLodSettings,
} from "./ObjectDefinition";

const OBJECT_CHUNK_DISTANCE_METERS =
  (PLANET_RADIUS_METERS * Math.PI * 0.5) / TERRAIN_BASE_CHUNKS_PER_FACE;

const DEFAULT_LOD_SETTINGS: ObjectLodSettings = {
  nearDistanceMeters: OBJECT_CHUNK_DISTANCE_METERS * 1.75,
  midDistanceMeters: OBJECT_CHUNK_DISTANCE_METERS * 3.5,
  farDistanceMeters: OBJECT_CHUNK_DISTANCE_METERS * 10,
  canDisappearWhenSmall: true,
  keepVisibleWhenLarge: true,
};

type PartTuple = [
  geometry: ObjectLodPart["geometry"],
  material: Material,
  position: [number, number, number],
  scale: [number, number, number],
  rotation?: Quaternion,
];

function createMaterial(
  color: string,
  lodLevel: ObjectLodLevel,
  emissive = "#000000",
  emissiveIntensity = 0,
): MeshStandardMaterial | MeshBasicMaterial {
  if (lodLevel === 2) {
    return new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
    });
  }

  return new MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness: lodLevel === 0 ? 0.72 : 0.9,
    metalness: lodLevel === 0 ? 0.08 : 0.02,
  });
}

function part(
  geometry: ObjectLodPart["geometry"],
  material: Material,
  localPosition: [number, number, number],
  localScale: [number, number, number],
  localRotation = new Quaternion(),
): ObjectLodPart {
  return {
    geometry,
    material,
    localPosition: new Vector3(...localPosition),
    localRotation: localRotation.clone(),
    localScale: new Vector3(...localScale),
  };
}

function parts(tuples: PartTuple[]): ObjectLodPart[] {
  return tuples.map(([geometry, material, position, scale, rotation]) =>
    part(geometry, material, position, scale, rotation),
  );
}

function rotationFromEuler(x: number, y: number, z: number): Quaternion {
  return new Quaternion().setFromEuler(new Euler(x, y, z));
}

function makeDefinition(
  definition: Omit<ObjectDefinition, "modelId" | "supportsInstancing"> & {
    modelId?: string;
    supportsInstancing?: boolean;
  },
): ObjectDefinition {
  return {
    ...definition,
    modelId: definition.modelId ?? definition.definitionId,
    supportsInstancing: definition.supportsInstancing ?? true,
  };
}

function makeCubeDefinition(): ObjectDefinition {
  const nearMaterial = createMaterial("#b9c0c4", 0);
  const midMaterial = createMaterial("#9da6aa", 1);
  const farMaterial = createMaterial("#7c8589", 2);
  const box = new BoxGeometry(1, 1, 1);

  return makeDefinition({
    definitionId: "cube_basic",
    name: "Cube",
    category: "Basic Shapes",
    description: "Shared instanced block object.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#b9c0c4",
    approximateBoundsRadiusMeters: 3.5,
    selectionRadiusMeters: 3.4,
    baseHeightMeters: 4,
    lodSettings: DEFAULT_LOD_SETTINGS,
    lod: {
      0: parts([[box, nearMaterial, [0, 2, 0], [4, 4, 4]]]),
      1: parts([[box, midMaterial, [0, 2, 0], [4, 4, 4]]]),
      2: parts([[box, farMaterial, [0, 2, 0], [4, 4, 4]]]),
    },
  });
}

function makeSphereDefinition(): ObjectDefinition {
  const nearMaterial = createMaterial("#8ea2b0", 0);
  const midMaterial = createMaterial("#7b8d98", 1);
  const farMaterial = createMaterial("#667782", 2);

  return makeDefinition({
    definitionId: "sphere_basic",
    name: "Sphere",
    category: "Basic Shapes",
    description: "Shared smooth marker volume.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#8ea2b0",
    approximateBoundsRadiusMeters: 2.5,
    selectionRadiusMeters: 3.4,
    baseHeightMeters: 5,
    lodSettings: DEFAULT_LOD_SETTINGS,
    lod: {
      0: parts([[new SphereGeometry(2.5, 24, 16), nearMaterial, [0, 2.5, 0], [1, 1, 1]]]),
      1: parts([[new SphereGeometry(2.5, 12, 8), midMaterial, [0, 2.5, 0], [1, 1, 1]]]),
      2: parts([[new SphereGeometry(2.5, 8, 5), farMaterial, [0, 2.5, 0], [1, 1, 1]]]),
    },
  });
}

function makeCylinderDefinition(): ObjectDefinition {
  const nearMaterial = createMaterial("#596167", 0);
  const midMaterial = createMaterial("#4c555b", 1);
  const farMaterial = createMaterial("#3f484e", 2);

  return makeDefinition({
    definitionId: "cylinder_basic",
    name: "Cylinder",
    category: "Basic Shapes",
    description: "Round vertical primitive.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#596167",
    approximateBoundsRadiusMeters: 3.1,
    selectionRadiusMeters: 3,
    baseHeightMeters: 5,
    lodSettings: DEFAULT_LOD_SETTINGS,
    lod: {
      0: parts([[new CylinderGeometry(1.8, 1.8, 5, 24, 1), nearMaterial, [0, 2.5, 0], [1, 1, 1]]]),
      1: parts([[new CylinderGeometry(1.8, 1.8, 5, 12, 1), midMaterial, [0, 2.5, 0], [1, 1, 1]]]),
      2: parts([[new CylinderGeometry(1.8, 1.8, 5, 6, 1), farMaterial, [0, 2.5, 0], [1, 1, 1]]]),
    },
  });
}

function makeConeDefinition(): ObjectDefinition {
  const nearMaterial = createMaterial("#b99b53", 0);
  const midMaterial = createMaterial("#9f884b", 1);
  const farMaterial = createMaterial("#7d6d42", 2);

  return makeDefinition({
    definitionId: "cone_basic",
    name: "Cone",
    category: "Basic Shapes",
    description: "Directional point or roof primitive.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#b99b53",
    approximateBoundsRadiusMeters: 3.2,
    selectionRadiusMeters: 3.2,
    baseHeightMeters: 5,
    lodSettings: DEFAULT_LOD_SETTINGS,
    lod: {
      0: parts([[new ConeGeometry(2.2, 5, 24, 1), nearMaterial, [0, 2.5, 0], [1, 1, 1]]]),
      1: parts([[new ConeGeometry(2.2, 5, 12, 1), midMaterial, [0, 2.5, 0], [1, 1, 1]]]),
      2: parts([[new ConeGeometry(2.2, 5, 6, 1), farMaterial, [0, 2.5, 0], [1, 1, 1]]]),
    },
  });
}

function makePlatformDefinition(): ObjectDefinition {
  const nearMaterial = createMaterial("#4d555a", 0);
  const midMaterial = createMaterial("#424a4f", 1);
  const farMaterial = createMaterial("#343c41", 2);
  const box = new BoxGeometry(1, 1, 1);

  return makeDefinition({
    definitionId: "platform_flat",
    name: "Flat Platform",
    category: "Structures",
    description: "Wide tangent pad for surface layouts.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#4d555a",
    approximateBoundsRadiusMeters: 11.4,
    selectionRadiusMeters: 11.5,
    baseHeightMeters: 1,
    lodSettings: {
      ...DEFAULT_LOD_SETTINGS,
      canDisappearWhenSmall: false,
      keepVisibleWhenLarge: true,
    },
    lod: {
      0: parts([[box, nearMaterial, [0, 0.5, 0], [16, 1, 16]]]),
      1: parts([[box, midMaterial, [0, 0.5, 0], [16, 1, 16]]]),
      2: parts([[box, farMaterial, [0, 0.5, 0], [16, 0.5, 16]]]),
    },
  });
}

function makePillarDefinition(): ObjectDefinition {
  const nearMaterial = createMaterial("#444b50", 0);
  const midMaterial = createMaterial("#394147", 1);
  const farMaterial = createMaterial("#30383e", 2);
  const box = new BoxGeometry(1, 1, 1);

  return makeDefinition({
    definitionId: "pillar_tall",
    name: "Tall Pillar",
    category: "Structures",
    description: "Vertical structure aligned to planet up.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#444b50",
    approximateBoundsRadiusMeters: 7.4,
    selectionRadiusMeters: 4.4,
    baseHeightMeters: 14,
    lodSettings: {
      ...DEFAULT_LOD_SETTINGS,
      keepVisibleWhenLarge: true,
    },
    lod: {
      0: parts([[new CylinderGeometry(1.4, 1.7, 14, 24, 1), nearMaterial, [0, 7, 0], [1, 1, 1]]]),
      1: parts([[new CylinderGeometry(1.4, 1.7, 14, 10, 1), midMaterial, [0, 7, 0], [1, 1, 1]]]),
      2: parts([[box, farMaterial, [0, 7, 0], [2.8, 14, 2.8]]]),
    },
  });
}

function makeRingDefinition(): ObjectDefinition {
  const nearMaterial = createMaterial("#4aa5bd", 0, "#123e4a", 0.18);
  const midMaterial = createMaterial("#3f8da2", 1);
  const farMaterial = createMaterial("#347184", 2);

  return makeDefinition({
    definitionId: "ring_marker",
    name: "Ring Marker",
    category: "Markers",
    description: "Upright torus marker with shared LOD assets.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#4aa5bd",
    accentColor: "#123e4a",
    approximateBoundsRadiusMeters: 3.9,
    selectionRadiusMeters: 4.5,
    baseHeightMeters: 6.9,
    lodSettings: DEFAULT_LOD_SETTINGS,
    lod: {
      0: parts([[new TorusGeometry(3.2, 0.35, 12, 40), nearMaterial, [0, 3.45, 0], [1, 1, 1]]]),
      1: parts([[new TorusGeometry(3.2, 0.35, 8, 18), midMaterial, [0, 3.45, 0], [1, 1, 1]]]),
      2: parts([[new TorusGeometry(3.2, 0.35, 5, 10), farMaterial, [0, 3.45, 0], [1, 1, 1]]]),
    },
  });
}

function makeSpawnMarkerDefinition(): ObjectDefinition {
  const nearBase = createMaterial("#3e6f52", 0);
  const nearTop = createMaterial("#6ead7a", 0, "#173d20", 0.12);
  const midMaterial = createMaterial("#558d63", 1);
  const farMaterial = createMaterial("#416d50", 2);
  const box = new BoxGeometry(1, 1, 1);

  return makeDefinition({
    definitionId: "spawn_marker",
    name: "Spawn Marker",
    category: "Markers",
    description: "Green local prototype spawn marker.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#6ead7a",
    accentColor: "#173d20",
    approximateBoundsRadiusMeters: 3.1,
    selectionRadiusMeters: 3.2,
    baseHeightMeters: 5.4,
    lodSettings: DEFAULT_LOD_SETTINGS,
    lod: {
      0: parts([
        [new CylinderGeometry(0.6, 0.75, 3.2, 16, 1), nearBase, [0, 1.6, 0], [1, 1, 1]],
        [new ConeGeometry(1.4, 2.2, 18, 1), nearTop, [0, 4.3, 0], [1, 1, 1]],
      ]),
      1: parts([[new ConeGeometry(1.4, 5.4, 10, 1), midMaterial, [0, 2.7, 0], [1, 1, 1]]]),
      2: parts([[box, farMaterial, [0, 2.7, 0], [1.8, 5.4, 1.8]]]),
    },
  });
}

function makeLightBeaconDefinition(): ObjectDefinition {
  const nearBase = createMaterial("#384248", 0);
  const nearGlow = createMaterial("#67d1d6", 0, "#3adce8", 0.9);
  const midGlow = createMaterial("#55bbc5", 1, "#2bb7c4", 0.45);
  const farGlow = createMaterial("#48a8b4", 2);
  const box = new BoxGeometry(1, 1, 1);

  return makeDefinition({
    definitionId: "light_beacon",
    name: "Light Beacon",
    category: "Markers",
    description: "Small emissive beacon without extra scene lights.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#67d1d6",
    accentColor: "#3adce8",
    approximateBoundsRadiusMeters: 3.1,
    selectionRadiusMeters: 3.3,
    baseHeightMeters: 5.8,
    lodSettings: DEFAULT_LOD_SETTINGS,
    lod: {
      0: parts([
        [new CylinderGeometry(0.45, 0.55, 4, 16, 1), nearBase, [0, 2, 0], [1, 1, 1]],
        [new SphereGeometry(1.1, 18, 12), nearGlow, [0, 4.7, 0], [1, 1, 1]],
      ]),
      1: parts([[new SphereGeometry(1.15, 10, 6), midGlow, [0, 4.2, 0], [1, 1, 1]]]),
      2: parts([[box, farGlow, [0, 3, 0], [1.5, 6, 1.5]]]),
    },
  });
}

function makeArchDefinition(): ObjectDefinition {
  const nearColumn = createMaterial("#3f474d", 0);
  const nearAccent = createMaterial("#66b9c6", 0, "#17424c", 0.22);
  const midMaterial = createMaterial("#364047", 1);
  const farMaterial = createMaterial("#29343a", 2);
  const box = new BoxGeometry(1, 1, 1);
  const accentBox = new BoxGeometry(1, 1, 1);

  return makeDefinition({
    definitionId: "arch_gate",
    name: "Arch / Gate",
    category: "Structures",
    description: "Simple primitive gate for prototype landmarks.",
    defaultScale: 1,
    minScale: 0.01,
    color: "#3f474d",
    accentColor: "#66b9c6",
    approximateBoundsRadiusMeters: 7,
    selectionRadiusMeters: 7,
    baseHeightMeters: 9.2,
    lodSettings: {
      ...DEFAULT_LOD_SETTINGS,
      canDisappearWhenSmall: false,
      keepVisibleWhenLarge: true,
    },
    lod: {
      0: parts([
        [box, nearColumn, [-3.4, 4, 0], [1.2, 8, 1.5]],
        [box, nearColumn, [3.4, 4, 0], [1.2, 8, 1.5]],
        [box, nearColumn, [0, 8.6, 0], [8, 1.2, 1.6]],
        [accentBox, nearAccent, [0, 6.2, 0], [5.2, 0.2, 1.75]],
      ]),
      1: parts([
        [box, midMaterial, [-3.4, 4, 0], [1.4, 8, 1.5]],
        [box, midMaterial, [3.4, 4, 0], [1.4, 8, 1.5]],
        [box, midMaterial, [0, 8.6, 0], [8, 1.4, 1.6]],
      ]),
      2: parts([
        [box, farMaterial, [0, 4.6, 0], [8, 9.2, 1.4]],
      ]),
    },
  });
}

export const OBJECT_DEFINITIONS: ObjectDefinition[] = [
  makeCubeDefinition(),
  makeSphereDefinition(),
  makeCylinderDefinition(),
  makeConeDefinition(),
  makePlatformDefinition(),
  makePillarDefinition(),
  makeRingDefinition(),
  makeSpawnMarkerDefinition(),
  makeLightBeaconDefinition(),
  makeArchDefinition(),
];

export class ObjectRegistry {
  private readonly definitionsById = new Map<string, ObjectDefinition>();

  constructor(readonly definitions = OBJECT_DEFINITIONS) {
    for (const definition of definitions) {
      this.definitionsById.set(definition.definitionId, definition);
    }
  }

  get count(): number {
    return this.definitions.length;
  }

  getById(definitionId: string): ObjectDefinition | undefined {
    return this.definitionsById.get(definitionId);
  }

  dispose(): void {
    const disposedGeometries = new Set<ObjectLodPart["geometry"]>();
    const disposedMaterials = new Set<Material>();

    for (const definition of this.definitions) {
      for (const lodParts of Object.values(definition.lod)) {
        for (const lodPart of lodParts) {
          if (!disposedGeometries.has(lodPart.geometry)) {
            lodPart.geometry.dispose();
            disposedGeometries.add(lodPart.geometry);
          }
          if (!disposedMaterials.has(lodPart.material)) {
            lodPart.material.dispose();
            disposedMaterials.add(lodPart.material);
          }
        }
      }
    }
  }
}
