export interface ObjectInstanceState {
  visible: boolean;
  selected: boolean;
  locked: boolean;
  active: boolean;
  variant: string;
  health: number;
  customColor: string | null;
  animationState: string | null;
  interactionState: string | null;
  metadata: Record<string, unknown>;
}

export function createDefaultObjectState(
  partial: Partial<ObjectInstanceState> = {},
): ObjectInstanceState {
  return {
    visible: true,
    selected: false,
    locked: false,
    active: true,
    variant: "default",
    health: 100,
    customColor: null,
    animationState: null,
    interactionState: null,
    metadata: {},
    ...partial,
  };
}
