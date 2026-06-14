import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import {
  DESKTOP_PIXEL_RATIO_CAP,
  MOBILE_PIXEL_RATIO_CAP,
} from "../world/WorldConstants";

export class Renderer {
  readonly renderer: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private renderScale = 1;
  private currentEffectivePixelRatio = 1;

  constructor(private readonly root: HTMLElement) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true,
    });
    this.canvas = this.renderer.domElement;
    this.renderer.setClearColor(0x080b10, 1);
    this.renderer.outputColorSpace = "srgb";
    this.root.appendChild(this.canvas);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  setRenderScale(renderScale: number): void {
    if (Math.abs(renderScale - this.renderScale) < 0.01) {
      return;
    }

    this.renderScale = renderScale;
    this.resize();
  }

  get effectivePixelRatio(): number {
    return this.currentEffectivePixelRatio;
  }

  resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatioCap = getPixelRatioCap();
    const basePixelRatio = Math.min(window.devicePixelRatio, pixelRatioCap);
    const pixelRatio = Math.min(
      pixelRatioCap,
      basePixelRatio * this.renderScale,
    );

    this.currentEffectivePixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
  };

  render(scene: Scene, camera: PerspectiveCamera): void {
    this.renderer.render(scene, camera);
  }
}

function getPixelRatioCap(): number {
  const coarsePointer =
    window.matchMedia?.("(hover: none), (pointer: coarse)").matches ?? false;
  const narrowViewport = Math.min(window.innerWidth, window.innerHeight) < 780;
  return coarsePointer || narrowViewport
    ? MOBILE_PIXEL_RATIO_CAP
    : DESKTOP_PIXEL_RATIO_CAP;
}
