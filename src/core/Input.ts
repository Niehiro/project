import { Vector2, Vector3 } from "three";
import { MobileInput } from "../mobile/MobileInput";

export interface KeyPressModifiers {
  shift: boolean;
  control: boolean;
  alt: boolean;
}

export class Input {
  private readonly keys = new Set<string>();
  private readonly pressedKeys = new Set<string>();
  private readonly pressedKeyModifiers = new Map<string, KeyPressModifiers>();
  private readonly mouseDelta = new Vector2();
  private wheelDelta = 0;
  private primaryClickQueued = false;
  private cameraControlsEnabled = true;
  private readonly mobileInput: MobileInput;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    root: HTMLElement,
  ) {
    this.mobileInput = new MobileInput(root, canvas);

    window.addEventListener("keydown", (event) => {
      if (shouldPreventBrowserShortcut(event.code)) {
        event.preventDefault();
      }

      if (!event.repeat) {
        this.pressedKeys.add(event.code);
        this.pressedKeyModifiers.set(event.code, {
          shift: event.shiftKey,
          control: event.ctrlKey,
          alt: event.altKey,
        });
      }
      this.keys.add(event.code);
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button === 0) {
        this.primaryClickQueued = true;
      }
    });

    this.canvas.addEventListener("click", () => {
      if (!this.cameraControlsEnabled) {
        return;
      }

      if (document.pointerLockElement !== this.canvas) {
        void this.canvas.requestPointerLock();
      }
    });

    window.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas) {
        return;
      }
      this.mouseDelta.x += event.movementX;
      this.mouseDelta.y += event.movementY;
    });

    window.addEventListener(
      "wheel",
      (event) => {
        this.wheelDelta += event.deltaY;
      },
      { passive: true },
    );
  }

  getMoveIntent(target = new Vector3()): Vector3 {
    target.set(0, 0, 0);
    if (!this.cameraControlsEnabled) {
      return target;
    }

    if (this.keys.has("KeyA")) target.x -= 1;
    if (this.keys.has("KeyD")) target.x += 1;
    if (this.keys.has("KeyW")) target.z += 1;
    if (this.keys.has("KeyS")) target.z -= 1;
    if (this.keys.has("Space")) target.y += 1;
    if (this.keys.has("ControlLeft") || this.keys.has("ControlRight") || this.keys.has("KeyC")) {
      target.y -= 1;
    }

    const mobileMove = this.mobileInput.getMoveIntent();
    target.x += mobileMove.x;
    target.z += mobileMove.y;
    target.y += this.mobileInput.getVerticalIntent();

    if (target.lengthSq() > 1) {
      target.normalize();
    }

    return target;
  }

  consumeLookDelta(target = new Vector2()): Vector2 {
    if (!this.cameraControlsEnabled) {
      this.mouseDelta.set(0, 0);
      target.set(0, 0);
      return target;
    }

    const mobileLook = this.mobileInput.consumeLookDelta();
    target.copy(this.mouseDelta).add(mobileLook);
    this.mouseDelta.set(0, 0);
    return target;
  }

  consumeWheelDelta(): number {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    return delta;
  }

  consumeKeyPress(code: string): boolean {
    if (!this.pressedKeys.has(code)) {
      return false;
    }

    this.pressedKeys.delete(code);
    this.pressedKeyModifiers.delete(code);
    return true;
  }

  consumeKeyPressWithModifiers(codes: string[]): KeyPressModifiers | null {
    for (const code of codes) {
      if (!this.pressedKeys.has(code)) {
        continue;
      }

      const modifiers =
        this.pressedKeyModifiers.get(code) ?? createCurrentModifiers(this);
      this.pressedKeys.delete(code);
      this.pressedKeyModifiers.delete(code);
      return modifiers;
    }

    return null;
  }

  consumePrimaryClick(): boolean {
    const clicked = this.primaryClickQueued;
    this.primaryClickQueued = false;
    return clicked;
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  isAltDown(): boolean {
    return this.keys.has("AltLeft") || this.keys.has("AltRight") || this.keys.has("Alt");
  }

  isControlDown(): boolean {
    return (
      this.keys.has("ControlLeft") ||
      this.keys.has("ControlRight") ||
      this.keys.has("Control")
    );
  }

  isBoosting(): boolean {
    return (
      this.keys.has("ShiftLeft") ||
      this.keys.has("ShiftRight") ||
      this.keys.has("Shift")
    );
  }

  setCameraControlsEnabled(enabled: boolean): void {
    if (this.cameraControlsEnabled === enabled) {
      return;
    }

    this.cameraControlsEnabled = enabled;
    this.mouseDelta.set(0, 0);

    if (!enabled && document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }
}

function createCurrentModifiers(input: Input): KeyPressModifiers {
  return {
    shift: input.isBoosting(),
    control: input.isControlDown(),
    alt: input.isAltDown(),
  };
}

function shouldPreventBrowserShortcut(code: string): boolean {
  return (
    code === "Tab" ||
    code === "Backspace" ||
    code === "BracketLeft" ||
    code === "BracketRight" ||
    code === "Space"
  );
}
