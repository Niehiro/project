import {
  AdditiveBlending,
  Color,
  ShaderMaterial,
  DoubleSide,
  Vector3,
} from "three";
import { SUN_LIGHT_POSITION_METERS } from "../world/WorldConstants";
import { TerrainChunkVisualType } from "../terrain/TerrainLOD";

const sunDirection = new Vector3(
  SUN_LIGHT_POSITION_METERS.x,
  SUN_LIGHT_POSITION_METERS.y,
  SUN_LIGHT_POSITION_METERS.z,
).normalize();

export function createSmoothPlanetMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 3,
    polygonOffsetUnits: 3,
    uniforms: {
      sunDirection: { value: sunDirection },
      baseColor: { value: new Color("#7fa36b") },
      lightColor: { value: new Color("#93b67f") },
      shadeColor: { value: new Color("#5f7a52") },
      rimColor: { value: new Color("#b8d4bd") },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 sunDirection;
      uniform vec3 baseColor;
      uniform vec3 lightColor;
      uniform vec3 shadeColor;
      uniform vec3 rimColor;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float diffuse = dot(normal, normalize(sunDirection));
        float day = smoothstep(-0.22, 0.92, diffuse);
        float terminator = smoothstep(-0.36, 0.12, diffuse);
        float softBands =
          sin(normal.x * 8.0 + normal.y * 3.0) *
          sin(normal.z * 7.0 - normal.y * 2.0);
        float visualTint = 0.01 * softBands;

        vec3 color = mix(shadeColor, baseColor, terminator);
        color = mix(color, lightColor, day * 0.58);
        color += visualTint * vec3(0.55, 0.75, 0.5);

        float viewGrazing = pow(1.0 - abs(dot(normal, viewDir)), 2.1);
        color = mix(color, rimColor, viewGrazing * 0.06);
        color = mix(color, shadeColor, viewGrazing * 0.035);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

export function createGridSurfaceMaterial(
  visualType: TerrainChunkVisualType,
): ShaderMaterial {
  const style = getChunkVisualStyle(visualType);

  return new ShaderMaterial({
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: style.polygonOffset,
    polygonOffsetUnits: style.polygonOffset,
    uniforms: {
      sunDirection: { value: sunDirection },
      baseColor: { value: new Color("#7fa36b") },
      lightColor: { value: new Color("#9abd87") },
      shadeColor: { value: new Color("#5f7a52") },
      rimColor: { value: new Color("#b8d4bd") },
      gridColor: { value: new Color(style.gridColor) },
      borderColor: { value: new Color(style.borderColor) },
      gridCells: { value: style.gridCells },
      gridStrength: { value: style.gridStrength },
      gridWidth: { value: style.gridWidth },
      borderStrength: { value: style.borderStrength },
      borderWidth: { value: style.borderWidth },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec2 vGridUv;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vGridUv = uv;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 sunDirection;
      uniform vec3 baseColor;
      uniform vec3 lightColor;
      uniform vec3 shadeColor;
      uniform vec3 rimColor;
      uniform vec3 gridColor;
      uniform vec3 borderColor;
      uniform float gridCells;
      uniform float gridStrength;
      uniform float gridWidth;
      uniform float borderStrength;
      uniform float borderWidth;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec2 vGridUv;

      float gridMask(vec2 uv) {
        vec2 cell = abs(fract(uv * gridCells) - 0.5);
        float distanceToLine = 0.5 - max(cell.x, cell.y);
        float aa = max(fwidth(distanceToLine) * 1.35, 0.0008);
        return 1.0 - smoothstep(gridWidth, gridWidth + aa, distanceToLine);
      }

      float borderMask(vec2 uv) {
        float edgeDistance = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
        float aa = max(fwidth(edgeDistance) * 1.8, 0.0009);
        return 1.0 - smoothstep(borderWidth, borderWidth + aa, edgeDistance);
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float diffuse = dot(normal, normalize(sunDirection));
        float day = smoothstep(-0.18, 0.9, diffuse);
        float terminator = smoothstep(-0.34, 0.12, diffuse);

        vec3 color = mix(shadeColor, baseColor, terminator);
        color = mix(color, lightColor, day * 0.58);

        float grid = gridMask(vGridUv);
        color = mix(color, gridColor, grid * gridStrength);

        float border = borderMask(vGridUv);
        color = mix(color, borderColor, border * borderStrength);

        float viewGrazing = pow(1.0 - abs(dot(normal, viewDir)), 2.1);
        color = mix(color, rimColor, viewGrazing * 0.045);
        color = mix(color, shadeColor, viewGrazing * 0.025);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function getChunkVisualStyle(visualType: TerrainChunkVisualType): {
  gridCells: number;
  gridStrength: number;
  gridWidth: number;
  gridColor: string;
  borderColor: string;
  borderStrength: number;
  borderWidth: number;
  polygonOffset: number;
} {
  switch (visualType) {
    case "type1NearDetailed":
      return {
        gridCells: 10,
        gridStrength: 0.5,
        gridWidth: 0.023,
        gridColor: "#3e5738",
        borderColor: "#1f3323",
        borderStrength: 0.82,
        borderWidth: 0.018,
        polygonOffset: -3,
      };
    case "type2MidSimplified":
      return {
        gridCells: 3.5,
        gridStrength: 0.16,
        gridWidth: 0.014,
        gridColor: "#4a6542",
        borderColor: "#2c4430",
        borderStrength: 0.55,
        borderWidth: 0.014,
        polygonOffset: -2,
      };
    case "type3FarSimplified":
      return {
        gridCells: 1.5,
        gridStrength: 0.07,
        gridWidth: 0.01,
        gridColor: "#52704b",
        borderColor: "#37533b",
        borderStrength: 0.34,
        borderWidth: 0.011,
        polygonOffset: -1,
      };
    case "type4GlobalUltraLow":
      return {
        gridCells: 1,
        gridStrength: 0.025,
        gridWidth: 0.008,
        gridColor: "#5e7c55",
        borderColor: "#496848",
        borderStrength: 0.2,
        borderWidth: 0.009,
        polygonOffset: 3,
      };
  }
}

export function createAtmosphereMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      glowColor: { value: new Color("#c8ecff") },
      innerColor: { value: new Color("#e8f6ff") },
      opacityScale: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform vec3 innerColor;
      uniform float opacityScale;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = pow(1.0 - abs(dot(normal, viewDir)), 3.1);
        float horizon = smoothstep(0.18, 1.0, rim);
        float alpha = (horizon * 0.105 + 0.0025) * opacityScale;
        vec3 color = mix(innerColor, glowColor, smoothstep(0.0, 1.0, rim));
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}

export function createStarMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    depthWrite: false,
    depthTest: true,
    transparent: true,
    uniforms: {
      color: { value: new Color("#ffffff") },
    },
    vertexShader: `
      void main() {
        gl_PointSize = 1.1;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        float alpha = smoothstep(0.5, 0.0, dist) * 0.46;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}
