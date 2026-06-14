import { Vector2 } from "three";

export class MobileInput {
  private joystickPointerId: number | null = null;
  private lookPointerId: number | null = null;
  private readonly joystickStart = new Vector2();
  private readonly joystickCurrent = new Vector2();
  private readonly lookLast = new Vector2();
  private readonly lookDelta = new Vector2();
  private verticalIntent = 0;

  constructor(root: HTMLElement, private readonly canvas: HTMLCanvasElement) {
    const joystick = document.createElement("div");
    joystick.className = "touch-zone";

    const buttons = document.createElement("div");
    buttons.className = "vertical-touch-buttons";

    const up = document.createElement("span");
    up.textContent = "↑";
    up.setAttribute("aria-label", "Move up");

    const down = document.createElement("span");
    down.textContent = "↓";
    down.setAttribute("aria-label", "Move down");

    buttons.append(up, down);
    root.append(joystick, buttons);

    this.bindVerticalButton(up, 1);
    this.bindVerticalButton(down, -1);

    window.addEventListener("pointerdown", this.handlePointerDown, {
      passive: false,
    });
    window.addEventListener("pointermove", this.handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
  }

  getMoveIntent(target = new Vector2()): Vector2 {
    if (this.joystickPointerId === null) {
      return target.set(0, 0);
    }

    const maxDistance = 56;
    return target
      .copy(this.joystickCurrent)
      .sub(this.joystickStart)
      .divideScalar(maxDistance)
      .clampScalar(-1, 1);
  }

  getVerticalIntent(): number {
    return this.verticalIntent;
  }

  consumeLookDelta(target = new Vector2()): Vector2 {
    target.copy(this.lookDelta);
    this.lookDelta.set(0, 0);
    return target;
  }

  private bindVerticalButton(element: HTMLElement, value: number): void {
    element.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.verticalIntent = value;
      element.setPointerCapture(event.pointerId);
    });

    const release = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.verticalIntent = 0;
    };

    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }

    if (event.target !== this.canvas) {
      return;
    }

    event.preventDefault();

    if (event.clientX < window.innerWidth * 0.45 && this.joystickPointerId === null) {
      this.joystickPointerId = event.pointerId;
      this.joystickStart.set(event.clientX, event.clientY);
      this.joystickCurrent.copy(this.joystickStart);
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (this.lookPointerId === null) {
      this.lookPointerId = event.pointerId;
      this.lookLast.set(event.clientX, event.clientY);
      this.canvas.setPointerCapture(event.pointerId);
    }
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.joystickPointerId) {
      event.preventDefault();
      this.joystickCurrent.set(event.clientX, event.clientY);
      return;
    }

    if (event.pointerId === this.lookPointerId) {
      event.preventDefault();
      this.lookDelta.x += event.clientX - this.lookLast.x;
      this.lookDelta.y += event.clientY - this.lookLast.y;
      this.lookLast.set(event.clientX, event.clientY);
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.joystickPointerId) {
      this.joystickPointerId = null;
      this.joystickCurrent.copy(this.joystickStart);
    }

    if (event.pointerId === this.lookPointerId) {
      this.lookPointerId = null;
      this.lookDelta.set(0, 0);
    }
  };
}
