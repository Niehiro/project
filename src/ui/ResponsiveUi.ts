export interface ResponsiveUiState {
  isMobileViewport: boolean;
  isTouchDevice: boolean;
  isMobileUi: boolean;
  isFullscreen: boolean;
  orientation: "portrait" | "landscape";
}

type ResponsiveUiListener = (state: ResponsiveUiState) => void;

export class ResponsiveUi {
  private readonly listeners = new Set<ResponsiveUiListener>();
  private readonly coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  private state: ResponsiveUiState;

  constructor(private readonly root: HTMLElement) {
    this.state = this.readState();
    this.applyRootClasses();

    window.addEventListener("resize", this.handleEnvironmentChange);
    window.addEventListener("orientationchange", this.handleEnvironmentChange);
    document.addEventListener("fullscreenchange", this.handleEnvironmentChange);
    this.coarsePointerQuery.addEventListener("change", this.handleEnvironmentChange);
  }

  getState(): ResponsiveUiState {
    return { ...this.state };
  }

  onChange(listener: ResponsiveUiListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private handleEnvironmentChange = (): void => {
    const nextState = this.readState();
    if (
      nextState.isMobileViewport === this.state.isMobileViewport &&
      nextState.isTouchDevice === this.state.isTouchDevice &&
      nextState.isMobileUi === this.state.isMobileUi &&
      nextState.isFullscreen === this.state.isFullscreen &&
      nextState.orientation === this.state.orientation
    ) {
      return;
    }

    this.state = nextState;
    this.applyRootClasses();
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  };

  private readState(): ResponsiveUiState {
    const isMobileViewport = window.innerWidth <= 768;
    const isTouchDevice =
      this.coarsePointerQuery.matches || navigator.maxTouchPoints > 0;

    return {
      isMobileViewport,
      isTouchDevice,
      isMobileUi: isMobileViewport || isTouchDevice,
      isFullscreen: Boolean(document.fullscreenElement),
      orientation:
        window.innerHeight > window.innerWidth ? "portrait" : "landscape",
    };
  }

  private applyRootClasses(): void {
    this.root.classList.toggle("ui-mobile", this.state.isMobileUi);
    this.root.classList.toggle("ui-desktop", !this.state.isMobileUi);
    this.root.classList.toggle("ui-portrait", this.state.orientation === "portrait");
    this.root.classList.toggle("ui-landscape", this.state.orientation === "landscape");
    this.root.classList.toggle("ui-fullscreen", this.state.isFullscreen);
  }
}
