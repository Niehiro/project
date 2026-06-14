import { Vector3 } from "three";

export class RealPosition {
  readonly value: Vector3;

  constructor(value = new Vector3()) {
    this.value = value.clone();
  }

  copy(position: Vector3): this {
    this.value.copy(position);
    return this;
  }

  clone(): RealPosition {
    return new RealPosition(this.value);
  }
}
