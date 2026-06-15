import { Vector2 } from "three";
import type { KeyPressModifiers } from "../core/Input";
import { ResponsiveUi } from "../ui/ResponsiveUi";

interface MobileControlCallbacks {
  queueKeyPress: (code: string, modifiers?: Partial<KeyPressModifiers>) => void;
  queuePrimaryClick: () => void;
  setKeyHeld: (code: string, held: boolean) => void;
  toggleDebug: () => void;
}

const JOYSTICK_RADIUS_PX = 56;
const JOYSTICK_DEAD_ZONE = 0.08;

export class MobileInput {
  private joystickPointerId: number | null = null;
  private lookPointerId: number | null = null;
  private readonly joystickStart = new Vector2();
  private readonly joystickCurrent = new Vector2();
  private readonly lookLast = new Vector2();
  private readonly lookDelta = new Vector2();
  private readonly joystickMove = new Vector2();
  private readonly joystickElement: HTMLDivElement;
  private readonly joystickKnob: HTMLDivElement;
  private readonly objectControls: HTMLDivElement;
  private readonly deleteButton: HTMLButtonElement;
  private readonly fullscreenButton: HTMLButtonElement;
  private verticalIntent = 0;
  private fullscreenFallbackTimeout = 0;

  constructor(
    root: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    responsiveUi: ResponsiveUi,
    private readonly callbacks: MobileControlCallbacks,
  ) {
    this.joystickElement = document.createElement("div");
    this.joystickElement.className = "touch-zone";
    this.joystickElement.setAttribute("aria-hidden", "true");

    this.joystickKnob = document.createElement("div");
    this.joystickKnob.className = "touch-zone__knob";
    this.joystickElement.appendChild(this.joystickKnob);

    const lookZone = document.createElement("div");
    lookZone.className = "mobile-look-zone";
    lookZone.setAttribute("aria-hidden", "true");

    const topControls = document.createElement("div");
    topControls.className = "mobile-top-controls";
    topControls.setAttribute("data-ui-control", "true");

    this.fullscreenButton = this.createButton("FS", "Toggle fullscreen", () => {
      void this.toggleFullscreen();
    });
    const debugButton = this.createButton("Debug", "Toggle debug details", () => {
      this.callbacks.toggleDebug();
    });
    const objectButton = this.createButton("Object", "Open object palette", () => {
      this.callbacks.queueKeyPress("Tab");
    });
    topControls.append(objectButton, debugButton, this.fullscreenButton);

    this.objectControls = document.createElement("div");
    this.objectControls.className = "mobile-object-controls";
    this.objectControls.setAttribute("data-ui-control", "true");
    this.objectControls.hidden = true;

    const placeButton = this.createButton("Place", "Place or use object", () => {
      this.callbacks.queuePrimaryClick();
    });
    const cancelButton = this.createButton("Cancel", "Cancel or close", () => {
      this.callbacks.queueKeyPress("Escape");
    });
    const rotateButton = this.createButton("Rotate", "Rotate object", () => {
      this.callbacks.queueKeyPress("KeyR");
    });
    const scaleUpButton = this.createButton("Scale +", "Increase object scale", () => {
      this.callbacks.queueKeyPress("BracketRight");
    });
    const scaleDownButton = this.createButton("Scale -", "Decrease object scale", () => {
      this.callbacks.queueKeyPress("BracketLeft");
    });
    this.deleteButton = this.createButton("Delete", "Delete selected object", () => {
      this.callbacks.queueKeyPress("Delete");
    });
    this.objectControls.append(
      placeButton,
      cancelButton,
      rotateButton,
      scaleUpButton,
      scaleDownButton,
      this.deleteButton,
    );

    const verticalButtons = document.createElement("div");
    verticalButtons.className = "vertical-touch-buttons";
    verticalButtons.setAttribute("data-ui-control", "true");

    const up = this.createHoldButton("Up", "Move up", () => {
      this.verticalIntent = 1;
    }, () => {
      this.verticalIntent = 0;
    });

    const down = this.createHoldButton("Down", "Move down", () => {
      this.verticalIntent = -1;
    }, () => {
      this.verticalIntent = 0;
    });

    const fast = this.createHoldButton("Fast", "Fast movement", () => {
      this.callbacks.setKeyHeld("Shift", true);
    }, () => {
      this.callbacks.setKeyHeld("Shift", false);
    });

    verticalButtons.append(up, down, fast);
    root.append(
      lookZone,
      this.joystickElement,
      verticalButtons,
      topControls,
      this.objectControls,
    );

    this.updateFullscreenButton();
    responsiveUi.onChange(() => this.updateFullscreenButton());
    document.addEventListener("fullscreenchange", this.updateFullscreenButton);

    window.addEventListener("pointerdown", this.handlePointerDown, {
      passive: false,
    });
    window.addEventListener("pointermove", this.handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
  }

  setObjectControlsActive(active: boolean, canDelete: boolean): void {
    this.objectControls.hidden = !active;
    this.deleteButton.hidden = !canDelete;
  }

  getMoveIntent(target = new Vector2()): Vector2 {
    if (this.joystickPointerId === null) {
      return target.set(0, 0);
    }

    target
      .copy(this.joystickCurrent)
      .sub(this.joystickStart)
      .divideScalar(JOYSTICK_RADIUS_PX)
      .clampScalar(-1, 1);

    if (target.length() < JOYSTICK_DEAD_ZONE) {
      return target.set(0, 0);
    }

    return target;
  }

  getVerticalIntent(): number {
    return this.verticalIntent;
  }

  consumeLookDelta(target = new Vector2()): Vector2 {
    target.copy(this.lookDelta);
    this.lookDelta.set(0, 0);
    return target;
  }

  private createButton(
    label: string,
    ariaLabel: string,
    onPress: () => void,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-control-button";
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    button.setAttribute("data-ui-control", "true");

    button.addEventListener("pointerdown", stopUiEvent);
    button.addEventListener("click", (event) => {
      stopUiEvent(event);
      onPress();
    });

    return button;
  }

  private createHoldButton(
    label: string,
    ariaLabel: string,
    onDown: () => void,
    onUp: () => void,
  ): HTMLButtonElement {
    const button = this.createButton(label, ariaLabel, () => undefined);

    button.addEventListener("pointerdown", (event) => {
      stopUiEvent(event);
      button.setPointerCapture(event.pointerId);
      button.classList.add("is-active");
      onDown();
    });

    const release = (event: PointerEvent) => {
      stopUiEvent(event);
      button.classList.remove("is-active");
      onUp();
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", () => {
      button.classList.remove("is-active");
      onUp();
    });

    return button;
  }

  private toggleFullscreen = async (): Promise<void> => {
    if (!document.fullscreenEnabled) {
      this.setFullscreenFallbackLabel("No FS");
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      this.updateFullscreenButton();
    } catch {
      this.setFullscreenFallbackLabel("Blocked");
    }
  };

  private updateFullscreenButton = (): void => {
    if (!document.fullscreenEnabled) {
      this.fullscreenButton.textContent = "No FS";
      this.fullscreenButton.disabled = true;
      return;
    }

    this.fullscreenButton.disabled = false;
    this.fullscreenButton.textContent = document.fullscreenElement ? "Exit" : "FS";
  };

  private setFullscreenFallbackLabel(label: string): void {
    window.clearTimeout(this.fullscreenFallbackTimeout);
    this.fullscreenButton.textContent = label;
    this.fullscreenFallbackTimeout = window.setTimeout(
      this.updateFullscreenButton,
      1400,
    );
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }

    if (isUiControlTarget(event.target)) {
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
      this.joystickElement.classList.add("is-active");
      this.updateJoystickKnob();
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
      this.joystickMove
        .set(event.clientX, event.clientY)
        .sub(this.joystickStart)
        .clampLength(0, JOYSTICK_RADIUS_PX);
      this.joystickCurrent.copy(this.joystickStart).add(this.joystickMove);
      this.updateJoystickKnob();
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
      this.joystickMove.set(0, 0);
      this.joystickElement.classList.remove("is-active");
      this.updateJoystickKnob();
    }

    if (event.pointerId === this.lookPointerId) {
      this.lookPointerId = null;
      this.lookDelta.set(0, 0);
    }
  };

  private updateJoystickKnob(): void {
    this.joystickKnob.style.transform = `translate(calc(-50% + ${this.joystickMove.x.toFixed(1)}px), calc(-50% + ${this.joystickMove.y.toFixed(1)}px))`;
  }
}

function stopUiEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

function isUiControlTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("[data-ui-control='true']"));
}
