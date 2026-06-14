import { ObjectInstance } from "./ObjectInstance";

export class ObjectSpatialIndex {
  private readonly zoneToInstanceIds = new Map<string, Set<string>>();
  private readonly instanceToZone = new Map<string, string>();

  add(instance: ObjectInstance): void {
    this.move(instance.instanceId, instance.zoneId);
  }

  remove(instanceId: string): void {
    const previousZone = this.instanceToZone.get(instanceId);
    if (!previousZone) {
      return;
    }

    const ids = this.zoneToInstanceIds.get(previousZone);
    ids?.delete(instanceId);
    if (ids?.size === 0) {
      this.zoneToInstanceIds.delete(previousZone);
    }
    this.instanceToZone.delete(instanceId);
  }

  move(instanceId: string, zoneId: string): void {
    const previousZone = this.instanceToZone.get(instanceId);
    if (previousZone === zoneId) {
      return;
    }

    if (previousZone) {
      const previousSet = this.zoneToInstanceIds.get(previousZone);
      previousSet?.delete(instanceId);
      if (previousSet?.size === 0) {
        this.zoneToInstanceIds.delete(previousZone);
      }
    }

    let ids = this.zoneToInstanceIds.get(zoneId);
    if (!ids) {
      ids = new Set<string>();
      this.zoneToInstanceIds.set(zoneId, ids);
    }

    ids.add(instanceId);
    this.instanceToZone.set(instanceId, zoneId);
  }

  getObjectsInZone(zoneId: string): string[] {
    return [...(this.zoneToInstanceIds.get(zoneId) ?? [])];
  }

  get activeZoneCount(): number {
    return this.zoneToInstanceIds.size;
  }

  clear(): void {
    this.zoneToInstanceIds.clear();
    this.instanceToZone.clear();
  }
}
