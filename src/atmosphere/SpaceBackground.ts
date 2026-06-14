import {
  BufferAttribute,
  BufferGeometry,
  Points,
  Scene,
  Vector3,
} from "three";
import { STAR_FIELD_RADIUS_METERS } from "../world/WorldConstants";
import { createStarMaterial } from "../planet/PlanetMaterial";

export class SpaceBackground {
  readonly points: Points;

  constructor(scene: Scene) {
    const positions: number[] = [];
    let seed = 7;

    for (let i = 0; i < 420; i += 1) {
      seed = pseudoRandom(seed);
      const z = seed * 2 - 1;
      seed = pseudoRandom(seed);
      const angle = seed * Math.PI * 2;
      const radius = Math.sqrt(1 - z * z);
      positions.push(
        Math.cos(angle) * radius * STAR_FIELD_RADIUS_METERS,
        z * STAR_FIELD_RADIUS_METERS,
        Math.sin(angle) * radius * STAR_FIELD_RADIUS_METERS,
      );
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));

    this.points = new Points(geometry, createStarMaterial());
    this.points.name = "LightweightStarField";
    scene.add(this.points);
  }

  update(cameraLocalPosition: Vector3, visible: boolean): void {
    this.points.position.copy(cameraLocalPosition);
    this.points.visible = visible;
  }
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
