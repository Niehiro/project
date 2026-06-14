import { Mesh, Scene, SphereGeometry, Vector3 } from "three";
import { PLANET_RADIUS_METERS, WorldMode } from "../world/WorldConstants";
import { createSmoothPlanetMaterial } from "./PlanetMaterial";
import { PlanetRenderer } from "./PlanetRenderer";

export class OrbitRenderer implements PlanetRenderer {
  readonly mesh: Mesh;

  constructor(scene: Scene) {
    this.mesh = new Mesh(
      new SphereGeometry(PLANET_RADIUS_METERS, 128, 64),
      createSmoothPlanetMaterial(),
    );
    this.mesh.name = "OrbitPlanetSameRealRadius";
    this.mesh.frustumCulled = true;
    scene.add(this.mesh);
  }

  update(
    localPlanetCenter: Vector3,
    mode: WorldMode,
    orbitEnabled: boolean,
  ): void {
    this.mesh.position.copy(localPlanetCenter);
    this.mesh.scale.setScalar(1);
    this.mesh.visible = orbitEnabled && mode !== "surface";
  }
}
