import { Mesh, Scene, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import {
  ATMOSPHERE_RADIUS_METERS,
  ORBIT_MODE_MIN_ALTITUDE_METERS,
  SURFACE_MODE_MAX_ALTITUDE_METERS,
  WorldMode,
} from "../world/WorldConstants";
import { createAtmosphereMaterial } from "../planet/PlanetMaterial";

export class Atmosphere {
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;

  constructor(scene: Scene) {
    this.mesh = new Mesh(
      new SphereGeometry(ATMOSPHERE_RADIUS_METERS, 128, 64),
      createAtmosphereMaterial(),
    );
    this.mesh.name = "AtmosphereSameRealRadius";
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  update(
    localPlanetCenter: Vector3,
    altitudeMeters: number,
    mode: WorldMode,
    atmosphereEnabled: boolean,
  ): void {
    this.mesh.position.copy(localPlanetCenter);
    this.mesh.scale.setScalar(1);
    const opacityScale = getAtmosphereOpacityScale(altitudeMeters, mode);
    this.mesh.visible = atmosphereEnabled && opacityScale > 0.01;

    this.mesh.material.uniforms.opacityScale.value = opacityScale;
  }
}

function getAtmosphereOpacityScale(
  altitudeMeters: number,
  mode: WorldMode,
): number {
  if (mode === "orbit") {
    return 0.88;
  }

  return smoothstep(
    SURFACE_MODE_MAX_ALTITUDE_METERS * 0.65,
    ORBIT_MODE_MIN_ALTITUDE_METERS,
    altitudeMeters,
  );
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
