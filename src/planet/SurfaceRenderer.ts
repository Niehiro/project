import { Group, Scene, Vector3 } from "three";
import { LOD_LEVELS, LODLevelSettings } from "../lod/LODSettings";
import { cameraToFaceUv } from "./PlanetMath";
import { QualityState } from "../performance/FrameStats";
import { TerrainChunk } from "../terrain/TerrainChunk";
import { TerrainChunkFactory } from "../terrain/TerrainChunkFactory";
import {
  TerrainChunkDescriptor,
  TerrainChunkVisualType,
  getTerrainChunkId,
} from "../terrain/TerrainLOD";
import {
  CHUNK_CACHE_MAX_AGE_MS,
  CHUNK_PRELOAD_RADIUS_MULTIPLIER,
  CHUNK_STREAM_PREDICTION_SECONDS,
  CHUNK_STREAM_UPDATE_INTERVAL_MS,
  CHUNK_UNLOAD_RADIUS_MULTIPLIER,
  PLANET_RADIUS_METERS,
  WorldMode,
} from "../world/WorldConstants";

type SurfaceChunkRole = "type1" | "type2" | "type3";

interface ChunkGridReference extends TerrainChunkDescriptor {
  id: string;
}

interface SurfaceStreamingPlan {
  role: SurfaceChunkRole;
  lod: LODLevelSettings;
  visualType: TerrainChunkVisualType;
  visibleRadius: number;
  criticalRadius: number;
  preloadRadius: number;
  unloadRadius: number;
  skipInnerRadius: number;
  activeLimit: number;
  queueLimit: number;
  gridStrength: number;
  currentRef: ChunkGridReference;
  predictedRef: ChunkGridReference;
}

interface QueuedChunkRequest {
  descriptor: TerrainChunkDescriptor;
  role: SurfaceChunkRole;
  priority: number;
  critical: boolean;
}

interface StreamingCandidate extends QueuedChunkRequest {
  visible: boolean;
}

export interface SurfaceStreamingDebugState {
  generatedThisFrame: number;
  restoredFromCacheThisFrame: number;
  unloadedThisFrame: number;
  visibleRadiusChunks: number;
  preloadRadiusChunks: number;
  unloadRadiusChunks: number;
  visibleDistanceMeters: number;
  preloadDistanceMeters: number;
  unloadDistanceMeters: number;
  currentChunkId: string;
  predictedChunkId: string;
  missingCriticalChunks: number;
  streamingStatus: string;
  chunkMeshesVisible: boolean;
  activeChunkLimit: number;
  desiredChunkCount: number;
  type1ActiveChunks: number;
  type2ActiveChunks: number;
  type3ActiveChunks: number;
  type1ActiveLimit: number;
  type2ActiveLimit: number;
  type3ActiveLimit: number;
  type1DesiredChunks: number;
  type2DesiredChunks: number;
  type3DesiredChunks: number;
  type1GridStrength: number;
  type2GridStrength: number;
  type3GridStrength: number;
}

export class SurfaceRenderer {
  readonly group = new Group();
  private readonly chunkFactory = new TerrainChunkFactory();
  private readonly activeChunks = new Map<string, TerrainChunk>();
  private readonly cachedChunks = new Map<string, TerrainChunk>();
  private readonly generationQueue: QueuedChunkRequest[] = [];
  private readonly queuedChunkIds = new Set<string>();
  private readonly predictedPosition = new Vector3();
  private currentChunkDrawRadius = 0;
  private currentPreloadRadius = 0;
  private currentUnloadRadius = 0;
  private currentChunkResolution = 0;
  private lastStreamPlanTimeMs = Number.NEGATIVE_INFINITY;
  private lastPlanKey = "";
  private debugState: SurfaceStreamingDebugState = createEmptyDebugState("idle");

  constructor(scene: Scene) {
    this.group.name = "SurfaceGridChunksPlanetCentered";
    scene.add(this.group);
  }

  get activeChunkCount(): number {
    return this.activeChunks.size;
  }

  get generationQueueLength(): number {
    return this.generationQueue.length;
  }

  get cachedChunkCount(): number {
    return this.cachedChunks.size;
  }

  get chunkDrawRadius(): number {
    return this.currentChunkDrawRadius;
  }

  get chunkResolution(): number {
    return this.currentChunkResolution;
  }

  get streamingDebugState(): SurfaceStreamingDebugState {
    return this.debugState;
  }

  update(
    cameraRealPosition: Vector3,
    cameraVelocity: Vector3,
    localPlanetCenter: Vector3,
    lod: LODLevelSettings,
    quality: QualityState,
    mode: WorldMode,
    surfaceEnabled: boolean,
  ): void {
    const now = performance.now();
    this.group.position.copy(localPlanetCenter);
    this.debugState.generatedThisFrame = 0;
    this.debugState.restoredFromCacheThisFrame = 0;
    this.debugState.unloadedThisFrame = 0;

    this.predictedPosition
      .copy(cameraVelocity)
      .multiplyScalar(CHUNK_STREAM_PREDICTION_SECONDS)
      .add(cameraRealPosition);

    const plans = surfaceEnabled
      ? getSurfaceStreamingPlans(
          cameraRealPosition,
          this.predictedPosition,
          lod,
          quality,
          mode,
        )
      : [];
    const shouldStreamSurface = plans.length > 0;
    this.group.visible = shouldStreamSurface;
    this.debugState.chunkMeshesVisible = this.group.visible;

    if (!shouldStreamSurface) {
      this.suspendStreaming(
        quality.maxCachedChunks,
        now,
        surfaceEnabled
          ? "T4 global only; detailed streaming disabled"
          : "surface disabled",
      );
      return;
    }

    const primaryPlan = plans[0];
    this.currentChunkDrawRadius = primaryPlan.visibleRadius;
    this.currentPreloadRadius = primaryPlan.preloadRadius;
    this.currentUnloadRadius = primaryPlan.unloadRadius;
    this.currentChunkResolution = Math.min(
      primaryPlan.lod.chunkResolution,
      quality.chunkResolution,
    );
    this.updatePlanDebug(plans);

    this.releaseChunksOutsideUnloadRadius(
      plans,
      quality.maxCachedChunks,
      now,
    );

    const planKey = getPlanKey(plans);
    const shouldRefreshPlan =
      now - this.lastStreamPlanTimeMs >= CHUNK_STREAM_UPDATE_INTERVAL_MS ||
      planKey !== this.lastPlanKey ||
      this.generationQueue.length === 0;

    if (shouldRefreshPlan) {
      this.rebuildGenerationQueue(plans);
      this.lastStreamPlanTimeMs = now;
      this.lastPlanKey = planKey;
    } else {
      this.pruneGenerationQueue(plans);
      this.debugState.missingCriticalChunks = this.countMissingCriticalChunks(
        plans,
      );
    }

    this.processGenerationQueue(plans, quality, now);
    this.enforceActiveChunkBudget(plans, quality.maxCachedChunks, now);
    this.debugState.missingCriticalChunks = this.countMissingCriticalChunks(
      plans,
    );
    this.pruneCache(quality.maxCachedChunks, now);
    this.updateActiveCounts();
    this.updateStreamingStatus();
  }

  clear(): void {
    for (const chunk of this.activeChunks.values()) {
      this.group.remove(chunk.mesh);
      chunk.dispose();
    }
    for (const chunk of this.cachedChunks.values()) {
      chunk.dispose();
    }
    this.activeChunks.clear();
    this.cachedChunks.clear();
    this.generationQueue.length = 0;
    this.queuedChunkIds.clear();
    this.currentChunkDrawRadius = 0;
    this.currentPreloadRadius = 0;
    this.currentUnloadRadius = 0;
    this.currentChunkResolution = 0;
    this.lastStreamPlanTimeMs = Number.NEGATIVE_INFINITY;
    this.lastPlanKey = "";
    this.debugState = createEmptyDebugState("cleared");
  }

  private suspendStreaming(
    maxCachedChunks: number,
    now: number,
    streamingStatus: string,
  ): void {
    for (const [id, chunk] of [...this.activeChunks]) {
      this.group.remove(chunk.mesh);
      this.activeChunks.delete(id);
      this.cacheOrDisposeChunk(chunk, maxCachedChunks, now);
    }

    this.generationQueue.length = 0;
    this.queuedChunkIds.clear();
    this.pruneCache(maxCachedChunks, now);
    this.currentChunkDrawRadius = 0;
    this.currentPreloadRadius = 0;
    this.currentUnloadRadius = 0;
    this.currentChunkResolution = 0;
    this.lastStreamPlanTimeMs = Number.NEGATIVE_INFINITY;
    this.lastPlanKey = "";
    this.debugState = {
      ...createEmptyDebugState(streamingStatus),
      generatedThisFrame: this.debugState.generatedThisFrame,
      restoredFromCacheThisFrame: this.debugState.restoredFromCacheThisFrame,
      unloadedThisFrame: this.debugState.unloadedThisFrame,
    };
  }

  private updatePlanDebug(plans: SurfaceStreamingPlan[]): void {
    const primaryPlan = plans[0];
    this.debugState.visibleRadiusChunks = primaryPlan.visibleRadius;
    this.debugState.preloadRadiusChunks = primaryPlan.preloadRadius;
    this.debugState.unloadRadiusChunks = primaryPlan.unloadRadius;
    this.debugState.visibleDistanceMeters = estimateChunkDistanceMeters(
      primaryPlan.visibleRadius,
      primaryPlan.lod,
    );
    this.debugState.preloadDistanceMeters = estimateChunkDistanceMeters(
      primaryPlan.preloadRadius,
      primaryPlan.lod,
    );
    this.debugState.unloadDistanceMeters = estimateChunkDistanceMeters(
      primaryPlan.unloadRadius,
      primaryPlan.lod,
    );
    this.debugState.currentChunkId = primaryPlan.currentRef.id;
    this.debugState.predictedChunkId = primaryPlan.predictedRef.id;
    this.debugState.activeChunkLimit = sumPlans(plans, "activeLimit");
    this.debugState.type1ActiveLimit = getPlanLimit(plans, "type1");
    this.debugState.type2ActiveLimit = getPlanLimit(plans, "type2");
    this.debugState.type3ActiveLimit = getPlanLimit(plans, "type3");
    this.debugState.type1GridStrength =
      plans.find((plan) => plan.role === "type1")?.gridStrength ?? 0;
    this.debugState.type2GridStrength =
      plans.find((plan) => plan.role === "type2")?.gridStrength ?? 0;
    this.debugState.type3GridStrength =
      plans.find((plan) => plan.role === "type3")?.gridStrength ?? 0;
  }

  private releaseChunksOutsideUnloadRadius(
    plans: SurfaceStreamingPlan[],
    maxCachedChunks: number,
    now: number,
  ): void {
    for (const [id, chunk] of [...this.activeChunks]) {
      if (!isDescriptorInsideAnyPlan(chunk.descriptor, plans, "unloadRadius")) {
        this.releaseActiveChunk(id, chunk, maxCachedChunks, now);
      }
    }

    this.enforceActiveChunkBudget(plans, maxCachedChunks, now);
  }

  private rebuildGenerationQueue(plans: SurfaceStreamingPlan[]): void {
    const candidates = new Map<string, StreamingCandidate>();

    for (const plan of plans) {
      this.addCandidateRing(candidates, plan, plan.currentRef, "current");
      this.addCandidateRing(candidates, plan, plan.predictedRef, "predicted");
    }

    const sortedCandidates = [...candidates.values()].sort(sortCandidates);
    const maxQueueLength = sumPlans(plans, "queueLimit");
    this.debugState.desiredChunkCount = sortedCandidates.length;
    this.debugState.type1DesiredChunks = countCandidatesByRole(
      sortedCandidates,
      "type1",
    );
    this.debugState.type2DesiredChunks = countCandidatesByRole(
      sortedCandidates,
      "type2",
    );
    this.debugState.type3DesiredChunks = countCandidatesByRole(
      sortedCandidates,
      "type3",
    );
    this.generationQueue.length = 0;
    this.queuedChunkIds.clear();

    for (const candidate of sortedCandidates) {
      if (this.generationQueue.length >= maxQueueLength) {
        break;
      }

      const id = getTerrainChunkId(candidate.descriptor);
      if (this.activeChunks.has(id)) {
        continue;
      }

      this.generationQueue.push({
        descriptor: candidate.descriptor,
        role: candidate.role,
        priority: candidate.priority,
        critical: candidate.critical,
      });
      this.queuedChunkIds.add(id);
    }

    this.debugState.missingCriticalChunks = this.countMissingCriticalChunks(
      plans,
    );
  }

  private addCandidateRing(
    candidates: Map<string, StreamingCandidate>,
    plan: SurfaceStreamingPlan,
    centerRef: ChunkGridReference,
    source: "current" | "predicted",
  ): void {
    const chunksPerFace = plan.lod.chunksPerFace;

    for (let dy = -plan.preloadRadius; dy <= plan.preloadRadius; dy += 1) {
      for (let dx = -plan.preloadRadius; dx <= plan.preloadRadius; dx += 1) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        if (ring <= plan.skipInnerRadius) {
          continue;
        }

        const x = centerRef.x + dx;
        const y = centerRef.y + dy;
        if (x < 0 || y < 0 || x >= chunksPerFace || y >= chunksPerFace) {
          continue;
        }

        const descriptor: TerrainChunkDescriptor = {
          face: centerRef.face,
          x,
          y,
          lod: plan.lod.lod,
          chunksPerFace,
          visualType: plan.visualType,
        };
        const id = getTerrainChunkId(descriptor);
        const currentVisible = isWithinChunkRadius(
          descriptor,
          plan.currentRef,
          plan.visibleRadius,
        );
        const predictedVisible = isWithinChunkRadius(
          descriptor,
          plan.predictedRef,
          plan.visibleRadius,
        );
        const critical = isWithinChunkRadius(
          descriptor,
          plan.currentRef,
          plan.criticalRadius,
        );
        const priority = getCandidatePriority(
          descriptor,
          plan,
          source,
          currentVisible,
          predictedVisible,
        );
        const existing = candidates.get(id);

        if (!existing || priority < existing.priority) {
          candidates.set(id, {
            descriptor,
            role: plan.role,
            priority,
            critical: critical || existing?.critical === true,
            visible:
              currentVisible || predictedVisible || existing?.visible === true,
          });
          continue;
        }

        existing.critical = existing.critical || critical;
        existing.visible = existing.visible || currentVisible || predictedVisible;
      }
    }
  }

  private pruneGenerationQueue(plans: SurfaceStreamingPlan[]): void {
    for (let index = this.generationQueue.length - 1; index >= 0; index -= 1) {
      const request = this.generationQueue[index];
      const id = getTerrainChunkId(request.descriptor);
      const stillRelevant = isDescriptorInsideAnyPlan(
        request.descriptor,
        plans,
        "preloadRadius",
      );

      if (!stillRelevant || this.activeChunks.has(id)) {
        this.generationQueue.splice(index, 1);
        this.queuedChunkIds.delete(id);
      }
    }

    this.generationQueue.sort(sortRequests);
  }

  private processGenerationQueue(
    plans: SurfaceStreamingPlan[],
    quality: QualityState,
    now: number,
  ): void {
    const startedAt = performance.now();
    let processedThisFrame = 0;

    while (
      processedThisFrame < quality.maxChunkGenerationsPerFrame &&
      this.generationQueue.length > 0 &&
      performance.now() - startedAt < quality.maxChunkGenerationTimeMs
    ) {
      const request = this.generationQueue.shift();
      if (!request) {
        break;
      }

      const id = getTerrainChunkId(request.descriptor);
      this.queuedChunkIds.delete(id);

      if (this.activeChunks.has(id)) {
        continue;
      }

      if (
        this.activeChunks.size >= this.debugState.activeChunkLimit &&
        !request.critical
      ) {
        this.generationQueue.unshift(request);
        this.queuedChunkIds.add(id);
        break;
      }

      if (
        !isDescriptorInsideAnyPlan(request.descriptor, plans, "preloadRadius")
      ) {
        continue;
      }

      const plan = getPlanForDescriptor(request.descriptor, plans);
      if (!plan) {
        continue;
      }

      if (
        countActiveChunksForPlan(this.activeChunks, plan) >= plan.activeLimit &&
        !request.critical
      ) {
        this.generationQueue.unshift(request);
        this.queuedChunkIds.add(id);
        break;
      }

      const cached = this.cachedChunks.get(id);
      if (cached) {
        this.cachedChunks.delete(id);
        cached.lastUsedTime = now;
        this.activeChunks.set(id, cached);
        this.group.add(cached.mesh);
        this.debugState.restoredFromCacheThisFrame += 1;
        processedThisFrame += 1;
        continue;
      }

      const resolution = Math.min(plan.lod.chunkResolution, quality.chunkResolution);
      const chunk = this.chunkFactory.createChunk(request.descriptor, resolution);
      chunk.lastUsedTime = now;
      this.activeChunks.set(chunk.id, chunk);
      this.group.add(chunk.mesh);
      this.debugState.generatedThisFrame += 1;
      processedThisFrame += 1;
    }
  }

  private enforceActiveChunkBudget(
    plans: SurfaceStreamingPlan[],
    maxCachedChunks: number,
    now: number,
  ): void {
    for (const plan of plans) {
      this.enforceRoleChunkBudget(plan, maxCachedChunks, now);
    }

    const activeChunkLimit = sumPlans(plans, "activeLimit");
    if (this.activeChunks.size <= activeChunkLimit) {
      return;
    }

    const evictionCandidates = [...this.activeChunks.entries()].sort(
      ([, a], [, b]) =>
        getActiveChunkEvictionScore(b.descriptor, plans) -
        getActiveChunkEvictionScore(a.descriptor, plans),
    );

    for (const [id, chunk] of evictionCandidates) {
      if (this.activeChunks.size <= activeChunkLimit) {
        break;
      }

      this.releaseActiveChunk(id, chunk, maxCachedChunks, now);
    }
  }

  private enforceRoleChunkBudget(
    plan: SurfaceStreamingPlan,
    maxCachedChunks: number,
    now: number,
  ): void {
    const matchingChunks = [...this.activeChunks.entries()].filter(([, chunk]) =>
      isSameChunkGrid(chunk.descriptor, plan.currentRef),
    );
    if (matchingChunks.length <= plan.activeLimit) {
      return;
    }

    matchingChunks.sort(
      ([, a], [, b]) =>
        getActiveChunkEvictionScore(b.descriptor, [plan]) -
        getActiveChunkEvictionScore(a.descriptor, [plan]),
    );

    for (const [id, chunk] of matchingChunks) {
      if (
        [...this.activeChunks.values()].filter((activeChunk) =>
          isSameChunkGrid(activeChunk.descriptor, plan.currentRef),
        ).length <= plan.activeLimit
      ) {
        break;
      }

      this.releaseActiveChunk(id, chunk, maxCachedChunks, now);
    }
  }

  private releaseActiveChunk(
    id: string,
    chunk: TerrainChunk,
    maxCachedChunks: number,
    now: number,
  ): void {
    this.group.remove(chunk.mesh);
    this.activeChunks.delete(id);
    this.debugState.unloadedThisFrame += 1;
    this.cacheOrDisposeChunk(chunk, maxCachedChunks, now);
  }

  private cacheOrDisposeChunk(
    chunk: TerrainChunk,
    maxCachedChunks: number,
    now: number,
  ): void {
    chunk.lastUsedTime = now;

    if (maxCachedChunks <= 0) {
      chunk.dispose();
      return;
    }

    const existing = this.cachedChunks.get(chunk.id);
    if (existing && existing !== chunk) {
      existing.dispose();
    }

    this.cachedChunks.set(chunk.id, chunk);
    this.pruneCache(maxCachedChunks, now);
  }

  private pruneCache(maxCachedChunks: number, now: number): void {
    for (const [id, chunk] of [...this.cachedChunks]) {
      if (now - chunk.lastUsedTime > CHUNK_CACHE_MAX_AGE_MS) {
        this.cachedChunks.delete(id);
        chunk.dispose();
      }
    }

    while (this.cachedChunks.size > maxCachedChunks) {
      const oldest = [...this.cachedChunks.entries()].sort(
        ([, a], [, b]) => a.lastUsedTime - b.lastUsedTime,
      )[0];
      if (!oldest) {
        break;
      }

      const [id, chunk] = oldest;
      this.cachedChunks.delete(id);
      chunk.dispose();
    }
  }

  private countMissingCriticalChunks(plans: SurfaceStreamingPlan[]): number {
    let missing = 0;

    for (const plan of plans) {
      for (let dy = -plan.criticalRadius; dy <= plan.criticalRadius; dy += 1) {
        for (let dx = -plan.criticalRadius; dx <= plan.criticalRadius; dx += 1) {
          const x = plan.currentRef.x + dx;
          const y = plan.currentRef.y + dy;
          if (
            x < 0 ||
            y < 0 ||
            x >= plan.currentRef.chunksPerFace ||
            y >= plan.currentRef.chunksPerFace
          ) {
            continue;
          }

          const id = getTerrainChunkId({
            face: plan.currentRef.face,
            x,
            y,
            lod: plan.currentRef.lod,
            chunksPerFace: plan.currentRef.chunksPerFace,
            visualType: plan.visualType,
          });
          if (!this.activeChunks.has(id)) {
            missing += 1;
          }
        }
      }
    }

    return missing;
  }

  private updateActiveCounts(): void {
    let type1 = 0;
    let type2 = 0;
    let type3 = 0;

    for (const chunk of this.activeChunks.values()) {
      if (chunk.descriptor.visualType === "type1NearDetailed") {
        type1 += 1;
      } else if (chunk.descriptor.visualType === "type2MidSimplified") {
        type2 += 1;
      } else if (chunk.descriptor.visualType === "type3FarSimplified") {
        type3 += 1;
      }
    }

    this.debugState.type1ActiveChunks = type1;
    this.debugState.type2ActiveChunks = type2;
    this.debugState.type3ActiveChunks = type3;
  }

  private updateStreamingStatus(): void {
    if (this.debugState.missingCriticalChunks > 0) {
      this.debugState.streamingStatus = "filling grid critical coverage";
      return;
    }

    if (this.activeChunks.size >= this.debugState.activeChunkLimit) {
      this.debugState.streamingStatus = "at grid LOD budget";
      return;
    }

    if (this.generationQueue.length > 0) {
      this.debugState.streamingStatus = "preloading grid path";
      return;
    }

    this.debugState.streamingStatus = "steady grid";
  }
}

function getSurfaceStreamingPlans(
  cameraRealPosition: Vector3,
  predictedPosition: Vector3,
  currentLod: LODLevelSettings,
  quality: QualityState,
  mode: WorldMode,
): SurfaceStreamingPlan[] {
  if (mode === "orbit") {
    return [];
  }

  if (mode === "transition") {
    const activeLimits = getTransitionActiveLimits(
      quality.maxActiveChunks,
      currentLod.lod <= 2,
    );
    const queueLimits = getTransitionQueueLimits(
      quality.maxGenerationQueueLength,
      currentLod.lod <= 2,
    );
    const plans = [
      createPlan(
        "type3",
        "type3FarSimplified",
        LOD_LEVELS[2],
        5,
        1,
        6,
        8,
        0,
        activeLimits.type3,
        queueLimits.type3,
        0.08,
        cameraRealPosition,
        predictedPosition,
      ),
    ];

    if (currentLod.lod <= 2) {
      plans.unshift(
        createPlan(
          "type2",
          "type2MidSimplified",
          LOD_LEVELS[1],
          2,
          1,
          3,
          5,
          -1,
          activeLimits.type2,
          queueLimits.type2,
          0.14,
          cameraRealPosition,
          predictedPosition,
        ),
      );
    }

    return plans;
  }

  const activeLimits = getSurfaceActiveLimits(quality.maxActiveChunks);
  const queueLimits = getSurfaceQueueLimits(quality.maxGenerationQueueLength);

  return [
    createPlan(
      "type1",
      "type1NearDetailed",
      LOD_LEVELS[0],
      4,
      3,
      5,
      7,
      -1,
      activeLimits.type1,
      queueLimits.type1,
      0.56,
      cameraRealPosition,
      predictedPosition,
    ),
    createPlan(
      "type2",
      "type2MidSimplified",
      LOD_LEVELS[1],
      6,
      1,
      8,
      10,
      -1,
      activeLimits.type2,
      queueLimits.type2,
      0.11,
      cameraRealPosition,
      predictedPosition,
    ),
    createPlan(
      "type3",
      "type3FarSimplified",
      LOD_LEVELS[2],
      7,
      1,
      9,
      12,
      0,
      activeLimits.type3,
      queueLimits.type3,
      0.08,
      cameraRealPosition,
      predictedPosition,
    ),
  ];
}

function getSurfaceActiveLimits(maxActiveChunks: number): Record<SurfaceChunkRole, number> {
  const budget = Math.max(0, Math.floor(maxActiveChunks));
  if (budget === 0) {
    return { type1: 0, type2: 0, type3: 0 };
  }

  let type1 = Math.min(88, Math.max(24, Math.floor(budget * 0.4)));
  let type2 = Math.min(112, Math.max(24, Math.floor(budget * 0.36)));

  if (type1 + type2 > budget) {
    type2 = Math.max(0, budget - type1);
  }

  let type3 = Math.min(80, Math.max(0, budget - type1 - type2));
  const minimumType3 = budget >= 80 ? 16 : Math.max(0, Math.floor(budget * 0.16));

  if (type3 < minimumType3) {
    const needed = minimumType3 - type3;
    const type2Reduction = Math.min(needed, Math.max(0, type2 - 24));
    type2 -= type2Reduction;
    const type1Reduction = Math.min(
      needed - type2Reduction,
      Math.max(0, type1 - 24),
    );
    type1 -= type1Reduction;
    type3 = Math.min(80, Math.max(0, budget - type1 - type2));
  }

  return { type1, type2, type3 };
}

function getSurfaceQueueLimits(maxQueueLength: number): Record<SurfaceChunkRole, number> {
  const budget = Math.max(0, Math.floor(maxQueueLength));
  const type1 = Math.min(100, Math.floor(budget * 0.28));
  const type2 = Math.min(160, Math.floor(budget * 0.42));
  const type3 = Math.max(0, budget - type1 - type2);
  return { type1, type2, type3 };
}

function getTransitionActiveLimits(
  maxActiveChunks: number,
  includeType2: boolean,
): Pick<Record<SurfaceChunkRole, number>, "type2" | "type3"> {
  const budget = Math.max(0, Math.floor(maxActiveChunks));
  const type2 = includeType2
    ? Math.min(36, Math.max(0, Math.floor(budget * 0.24)))
    : 0;
  const type3 = Math.min(72, Math.max(0, budget - type2));
  return { type2, type3 };
}

function getTransitionQueueLimits(
  maxQueueLength: number,
  includeType2: boolean,
): Pick<Record<SurfaceChunkRole, number>, "type2" | "type3"> {
  const budget = Math.max(0, Math.floor(maxQueueLength));
  const type2 = includeType2 ? Math.min(48, Math.floor(budget * 0.28)) : 0;
  const type3 = Math.max(0, budget - type2);
  return { type2, type3 };
}

function createPlan(
  role: SurfaceChunkRole,
  visualType: TerrainChunkVisualType,
  lod: LODLevelSettings,
  visibleRadius: number,
  criticalRadius: number,
  preloadRadius: number,
  unloadRadius: number,
  skipInnerRadius: number,
  activeLimit: number,
  queueLimit: number,
  gridStrength: number,
  cameraRealPosition: Vector3,
  predictedPosition: Vector3,
): SurfaceStreamingPlan {
  const expandedPreloadRadius = Math.max(
    preloadRadius,
    Math.ceil(visibleRadius * CHUNK_PRELOAD_RADIUS_MULTIPLIER),
  );
  const expandedUnloadRadius = Math.max(
    unloadRadius,
    Math.ceil(visibleRadius * CHUNK_UNLOAD_RADIUS_MULTIPLIER),
  );

  return {
    role,
    lod,
    visualType,
    visibleRadius,
    criticalRadius,
    preloadRadius: expandedPreloadRadius,
    unloadRadius: expandedUnloadRadius,
    skipInnerRadius,
    activeLimit,
    queueLimit,
    gridStrength,
    currentRef: getChunkGridReference(cameraRealPosition, lod, visualType),
    predictedRef: getChunkGridReference(predictedPosition, lod, visualType),
  };
}

function getChunkGridReference(
  cameraRealPosition: Vector3,
  lod: LODLevelSettings,
  visualType: TerrainChunkVisualType,
): ChunkGridReference {
  const { face, u, v } = cameraToFaceUv(cameraRealPosition);
  const chunksPerFace = lod.chunksPerFace;
  const x = clampIndex(
    Math.floor(((u + 1) * 0.5) * chunksPerFace),
    chunksPerFace,
  );
  const y = clampIndex(
    Math.floor(((v + 1) * 0.5) * chunksPerFace),
    chunksPerFace,
  );
  const descriptor = {
    face,
    x,
    y,
    lod: lod.lod,
    chunksPerFace,
    visualType,
  };

  return {
    ...descriptor,
    id: getTerrainChunkId(descriptor),
  };
}

function isDescriptorInsideAnyPlan(
  descriptor: TerrainChunkDescriptor,
  plans: SurfaceStreamingPlan[],
  radiusKey: "preloadRadius" | "unloadRadius",
): boolean {
  return plans.some((plan) => {
    if (!isSameChunkGrid(descriptor, plan.currentRef)) {
      return false;
    }

    return (
      isWithinChunkRadius(descriptor, plan.currentRef, plan[radiusKey]) ||
      isWithinChunkRadius(descriptor, plan.predictedRef, plan[radiusKey])
    );
  });
}

function isWithinChunkRadius(
  descriptor: TerrainChunkDescriptor,
  reference: ChunkGridReference,
  radius: number,
): boolean {
  if (!isSameChunkGrid(descriptor, reference)) {
    return false;
  }

  return (
    Math.abs(descriptor.x - reference.x) <= radius &&
    Math.abs(descriptor.y - reference.y) <= radius
  );
}

function getDescriptorDistanceSq(
  descriptor: TerrainChunkDescriptor,
  reference: ChunkGridReference,
): number {
  if (!isSameChunkGrid(descriptor, reference)) {
    return Number.POSITIVE_INFINITY;
  }

  const dx = descriptor.x - reference.x;
  const dy = descriptor.y - reference.y;
  return dx * dx + dy * dy;
}

function getChunkRingDistance(
  descriptor: TerrainChunkDescriptor,
  reference: ChunkGridReference,
): number {
  if (!isSameChunkGrid(descriptor, reference)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(
    Math.abs(descriptor.x - reference.x),
    Math.abs(descriptor.y - reference.y),
  );
}

function isSameChunkGrid(
  descriptor: TerrainChunkDescriptor,
  reference: TerrainChunkDescriptor,
): boolean {
  return (
    descriptor.face === reference.face &&
    descriptor.lod === reference.lod &&
    descriptor.chunksPerFace === reference.chunksPerFace &&
    descriptor.visualType === reference.visualType
  );
}

function getCandidatePriority(
  descriptor: TerrainChunkDescriptor,
  plan: SurfaceStreamingPlan,
  source: "current" | "predicted",
  currentVisible: boolean,
  predictedVisible: boolean,
): number {
  const currentDistanceSq = getDescriptorDistanceSq(descriptor, plan.currentRef);
  const predictedDistanceSq = getDescriptorDistanceSq(
    descriptor,
    plan.predictedRef,
  );
  const ringDistance = Math.min(
    getChunkRingDistance(descriptor, plan.currentRef),
    getChunkRingDistance(descriptor, plan.predictedRef),
  );
  let priority =
    Math.min(currentDistanceSq, predictedDistanceSq) * 12 + ringDistance * 8;

  if (plan.role === "type1") {
    priority -= 360;
  }
  if (plan.role === "type2") {
    priority -= 120;
  }
  if (plan.role === "type3") {
    priority += 80;
  }
  if (currentVisible) {
    priority -= 1_000;
  }
  if (predictedVisible) {
    priority -= 500;
  }
  if (source === "current") {
    priority -= 80;
  } else {
    priority -= 40;
  }

  return priority - getForwardPathBias(descriptor, plan);
}

function getForwardPathBias(
  descriptor: TerrainChunkDescriptor,
  plan: SurfaceStreamingPlan,
): number {
  if (
    plan.currentRef.face !== plan.predictedRef.face ||
    plan.currentRef.lod !== plan.predictedRef.lod ||
    plan.currentRef.chunksPerFace !== plan.predictedRef.chunksPerFace
  ) {
    return 0;
  }

  const pathX = plan.predictedRef.x - plan.currentRef.x;
  const pathY = plan.predictedRef.y - plan.currentRef.y;
  const pathLength = Math.hypot(pathX, pathY);
  if (pathLength < 0.001) {
    return 0;
  }

  const candidateX = descriptor.x - plan.currentRef.x;
  const candidateY = descriptor.y - plan.currentRef.y;
  const forwardDistance = (candidateX * pathX + candidateY * pathY) / pathLength;
  return Math.max(0, Math.min(80, forwardDistance * 6));
}

function getActiveChunkEvictionScore(
  descriptor: TerrainChunkDescriptor,
  plans: SurfaceStreamingPlan[],
): number {
  const plan = getPlanForDescriptor(descriptor, plans);
  if (!plan) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(
    getDescriptorDistanceSq(descriptor, plan.currentRef),
    getDescriptorDistanceSq(descriptor, plan.predictedRef),
  );
}

function getPlanForDescriptor(
  descriptor: TerrainChunkDescriptor,
  plans: SurfaceStreamingPlan[],
): SurfaceStreamingPlan | undefined {
  return plans.find((plan) => isSameChunkGrid(descriptor, plan.currentRef));
}

function sortCandidates(a: StreamingCandidate, b: StreamingCandidate): number {
  if (a.critical !== b.critical) {
    return a.critical ? -1 : 1;
  }
  if (a.visible !== b.visible) {
    return a.visible ? -1 : 1;
  }
  return a.priority - b.priority;
}

function sortRequests(a: QueuedChunkRequest, b: QueuedChunkRequest): number {
  if (a.critical !== b.critical) {
    return a.critical ? -1 : 1;
  }
  return a.priority - b.priority;
}

function sumPlans(
  plans: SurfaceStreamingPlan[],
  key: "activeLimit" | "queueLimit",
): number {
  return plans.reduce((sum, plan) => sum + plan[key], 0);
}

function getPlanLimit(
  plans: SurfaceStreamingPlan[],
  role: SurfaceChunkRole,
): number {
  return plans
    .filter((plan) => plan.role === role)
    .reduce((sum, plan) => sum + plan.activeLimit, 0);
}

function countCandidatesByRole(
  candidates: StreamingCandidate[],
  role: SurfaceChunkRole,
): number {
  return candidates.filter((candidate) => candidate.role === role).length;
}

function countActiveChunksForPlan(
  activeChunks: Map<string, TerrainChunk>,
  plan: SurfaceStreamingPlan,
): number {
  let count = 0;
  for (const chunk of activeChunks.values()) {
    if (isSameChunkGrid(chunk.descriptor, plan.currentRef)) {
      count += 1;
    }
  }
  return count;
}

function getPlanKey(plans: SurfaceStreamingPlan[]): string {
  return plans
    .map(
      (plan) =>
        `${plan.role}:${plan.currentRef.id}:${plan.predictedRef.id}:${plan.activeLimit}`,
    )
    .join("|");
}

function estimateChunkDistanceMeters(
  chunkRadius: number,
  lod: LODLevelSettings,
): number {
  const approximateChunkArcMeters =
    (PLANET_RADIUS_METERS * Math.PI * 0.5) / lod.chunksPerFace;
  return approximateChunkArcMeters * chunkRadius;
}

function createEmptyDebugState(
  streamingStatus: string,
): SurfaceStreamingDebugState {
  return {
    generatedThisFrame: 0,
    restoredFromCacheThisFrame: 0,
    unloadedThisFrame: 0,
    visibleRadiusChunks: 0,
    preloadRadiusChunks: 0,
    unloadRadiusChunks: 0,
    visibleDistanceMeters: 0,
    preloadDistanceMeters: 0,
    unloadDistanceMeters: 0,
    currentChunkId: "none",
    predictedChunkId: "none",
    missingCriticalChunks: 0,
    streamingStatus,
    chunkMeshesVisible: false,
    activeChunkLimit: 0,
    desiredChunkCount: 0,
    type1ActiveChunks: 0,
    type2ActiveChunks: 0,
    type3ActiveChunks: 0,
    type1ActiveLimit: 0,
    type2ActiveLimit: 0,
    type3ActiveLimit: 0,
    type1DesiredChunks: 0,
    type2DesiredChunks: 0,
    type3DesiredChunks: 0,
    type1GridStrength: 0,
    type2GridStrength: 0,
    type3GridStrength: 0,
  };
}

function clampIndex(value: number, size: number): number {
  return Math.min(size - 1, Math.max(0, value));
}
