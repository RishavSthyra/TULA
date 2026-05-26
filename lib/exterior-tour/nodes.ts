import {
  clamp,
  degToRad,
  distancePlanar,
  dotPlanar,
  median,
  negativeVec3,
  normalizePlanar,
  perpendicularRight,
  subVec3,
  vec3,
  wrapAngleRad,
  type Vec3,
} from "@/lib/exterior-tour/math";
import type {
  DirectionalNavMap,
  ExteriorPanoNodeSource,
  ExteriorTourGraph,
  ExteriorTourNeighbor,
  ExteriorTourNode,
  NavigationDirection,
} from "@/lib/exterior-tour/types";

const MAX_NEIGHBORS = 6;
const DIRECTION_DUPLICATE_DOT = 0.965;

export function imageFilenameToPanoId(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/^NewLS_/i, "LS_");
}

export function formatExteriorNodeLabel(panoId: string, order: number) {
  const segmentMatch = panoId.match(/Exterior(\d+)/i);
  const frameMatch = panoId.match(/F(\d{4})$/i);

  const segment = segmentMatch?.[1];
  const frame = frameMatch?.[1] ?? String(order + 1).padStart(4, "0");

  return segment
    ? `Exterior ${segment} / Node ${frame}`
    : `Exterior Node ${frame}`;
}

function forwardFromYaw(yawDegrees: number) {
  const radians = degToRad(yawDegrees);
  return normalizePlanar(
    {
      x: Math.cos(radians),
      y: Math.sin(radians),
      z: 0,
    },
    vec3(0, -1, 0),
  );
}

function buildBaseNode(source: ExteriorPanoNodeSource, order: number): ExteriorTourNode {
  const fallbackForward = forwardFromYaw(source.yaw);
  const forward = normalizePlanar(source.forward_vector ?? fallbackForward, fallbackForward);
  const right = normalizePlanar(
    source.right_vector ?? perpendicularRight(forward),
    perpendicularRight(forward),
  );
  const left = normalizePlanar(source.left_vector ?? negativeVec3(right), negativeVec3(right));
  const panoId = imageFilenameToPanoId(source.image_filename);

  return {
    id: source.id,
    order,
    panoId,
    label: formatExteriorNodeLabel(panoId, order),
    imageFilename: source.image_filename,
    rawPosition: { x: source.x, y: source.y, z: source.z },
    forward,
    right,
    left,
    pitch: source.pitch,
    yaw: source.yaw,
    roll: source.roll,
    facingAxis: source.facing_axis,
    nearestDistance: 0,
    neighbors: [],
  };
}

function buildNeighborGraph(nodes: ExteriorTourNode[], medianNearestDistance: number) {
  const adjacency = new Map<string, Set<string>>();

  for (const node of nodes) {
    const ranked = nodes
      .filter((candidate) => candidate.id !== node.id)
      .map((candidate) => {
        const delta = subVec3(candidate.rawPosition, node.rawPosition);
        const direction = normalizePlanar(delta, node.forward);

        return {
          id: candidate.id,
          distance: distancePlanar(candidate.rawPosition, node.rawPosition),
          direction,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    const nearestDistance = ranked[0]?.distance ?? medianNearestDistance;
    const maxDistance = Math.min(nearestDistance * 2.8, medianNearestDistance * 2.2);
    const selected: typeof ranked = [];

    for (const candidate of ranked) {
      if (candidate.distance > maxDistance) {
        continue;
      }

      const duplicateDirection = selected.some(
        (existing) => dotPlanar(existing.direction, candidate.direction) > DIRECTION_DUPLICATE_DOT,
      );

      if (duplicateDirection) {
        continue;
      }

      selected.push(candidate);
      if (selected.length >= MAX_NEIGHBORS) {
        break;
      }
    }

    adjacency.set(node.id, new Set(selected.map((candidate) => candidate.id)));
  }

  for (const [nodeId, neighbors] of adjacency) {
    for (const neighborId of neighbors) {
      adjacency.get(neighborId)?.add(nodeId);
    }
  }

  return nodes.map((node) => {
    const connectedIds = [...(adjacency.get(node.id) ?? new Set<string>())];
    const rankedNeighbors = connectedIds
      .map((id) => {
        const target = nodes.find((candidate) => candidate.id === id);
        if (!target) {
          return null;
        }

        const delta = subVec3(target.rawPosition, node.rawPosition);
        const direction = normalizePlanar(delta, node.forward);
        const distance = distancePlanar(target.rawPosition, node.rawPosition);

        return {
          id,
          distance,
          direction,
          alignment: dotPlanar(direction, node.forward),
        } satisfies ExteriorTourNeighbor;
      })
      .filter((neighbor): neighbor is ExteriorTourNeighbor => neighbor !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_NEIGHBORS);

    return {
      ...node,
      nearestDistance: rankedNeighbors[0]?.distance ?? medianNearestDistance,
      neighbors: rankedNeighbors,
    };
  });
}

export function buildExteriorTourGraph(sourceNodes: ExteriorPanoNodeSource[]): ExteriorTourGraph {
  const validNodes = [...sourceNodes].sort((a, b) => {
    const aFrame = Number(a.id.match(/F(\d{4})$/i)?.[1] ?? a.frame ?? 0);
    const bFrame = Number(b.id.match(/F(\d{4})$/i)?.[1] ?? b.frame ?? 0);
    return aFrame - bFrame;
  });

  const nearestDistances = validNodes.map((node) => {
    const distances = validNodes
      .filter((candidate) => candidate.id !== node.id)
      .map((candidate) => distancePlanar(node, candidate))
      .sort((a, b) => a - b);

    return distances[0] ?? 1;
  });

  const medianNearestDistance = Math.max(
    1,
    median(nearestDistances.length > 0 ? nearestDistances : [1]),
  );

  const baseNodes = validNodes.map((node, order) => buildBaseNode(node, order));
  const nodes = buildNeighborGraph(baseNodes, medianNearestDistance);
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<
    string,
    ExteriorTourNode
  >;

  return {
    nodes,
    byId,
    order: nodes.map((node) => node.id),
    medianNearestDistance,
  };
}

export function getSequentialNodeIds(graph: ExteriorTourGraph, nodeId: string) {
  const index = graph.order.indexOf(nodeId);
  return {
    index,
    previousId: index > 0 ? graph.order[index - 1] : null,
    nextId: index >= 0 && index < graph.order.length - 1 ? graph.order[index + 1] : null,
  };
}

function getDirectionAxis(node: ExteriorTourNode, direction: NavigationDirection): Vec3 {
  switch (direction) {
    case "left":
      return node.left;
    case "right":
      return node.right;
    case "backward":
      return negativeVec3(node.forward);
    case "forward":
    default:
      return node.forward;
  }
}

function scoreDirectionalCandidate(
  node: ExteriorTourNode,
  neighbor: ExteriorTourNeighbor,
  direction: NavigationDirection,
  isSequentialPreferred: boolean,
) {
  const axis = getDirectionAxis(node, direction);
  const axisAlignment = dotPlanar(neighbor.direction, axis);
  const distanceBias =
    1 -
    clamp(
      neighbor.distance / Math.max(node.nearestDistance * 2.6, 1),
      0,
      1,
    );
  const lateralPenalty =
    direction === "forward" || direction === "backward"
      ? Math.abs(dotPlanar(neighbor.direction, node.right)) * 0.18
      : Math.abs(dotPlanar(neighbor.direction, node.forward)) * 0.08;
  const sequentialBonus = isSequentialPreferred ? 0.18 : 0;

  return axisAlignment * 0.72 + distanceBias * 0.18 + sequentialBonus - lateralPenalty;
}

function scoreDirectionalVectorCandidate(
  node: ExteriorTourNode,
  candidate: ExteriorTourNode,
  direction: NavigationDirection,
  isSequentialPreferred: boolean,
) {
  const delta = subVec3(candidate.rawPosition, node.rawPosition);
  const distance = distancePlanar(candidate.rawPosition, node.rawPosition);
  const candidateDirection = normalizePlanar(delta, node.forward);
  const axis = getDirectionAxis(node, direction);
  const axisAlignment = dotPlanar(candidateDirection, axis);
  const distanceBias =
    1 -
    clamp(
      distance / Math.max(node.nearestDistance * 7.5, 1),
      0,
      1,
    );
  const lateralPenalty =
    direction === "forward" || direction === "backward"
      ? Math.abs(dotPlanar(candidateDirection, node.right)) * 0.2
      : Math.abs(dotPlanar(candidateDirection, node.forward)) * 0.1;
  const sequentialBonus = isSequentialPreferred ? 0.22 : 0;

  return axisAlignment * 0.7 + distanceBias * 0.2 + sequentialBonus - lateralPenalty;
}

export function getDirectionalTarget(
  graph: ExteriorTourGraph,
  nodeId: string,
  direction: NavigationDirection,
) {
  const node = graph.byId[nodeId];
  if (!node) {
    return { direction, node: null, score: -Infinity };
  }

  const sequential = getSequentialNodeIds(graph, nodeId);
  const sequentialId =
    direction === "forward"
      ? sequential.nextId
      : direction === "backward"
        ? sequential.previousId
        : null;

  let bestNode: ExteriorTourNode | null = null;
  let bestScore = -Infinity;

  for (const neighbor of node.neighbors) {
    const candidate = graph.byId[neighbor.id];
    if (!candidate) {
      continue;
    }

    const score = scoreDirectionalCandidate(
      node,
      neighbor,
      direction,
      sequentialId === candidate.id,
    );

    if (score > bestScore) {
      bestScore = score;
      bestNode = candidate;
    }
  }

  if ((!bestNode || bestScore < 0.08) && sequentialId) {
    return {
      direction,
      node: graph.byId[sequentialId] ?? null,
      score: 0.18,
    };
  }

  return {
    direction,
    node: bestNode,
    score: bestScore,
  };
}

export function getDirectionalCandidates(
  graph: ExteriorTourGraph,
  nodeId: string,
  direction: NavigationDirection,
) {
  const node = graph.byId[nodeId];
  if (!node) {
    return [] as Array<{ node: ExteriorTourNode; score: number }>;
  }

  const sequential = getSequentialNodeIds(graph, nodeId);
  const sequentialIds =
    direction === "forward"
      ? graph.order.slice(sequential.index + 1)
      : direction === "backward"
        ? [...graph.order.slice(0, Math.max(sequential.index, 0))].reverse()
        : [];

  const ranked = node.neighbors
    .map((neighbor) => {
      const candidate = graph.byId[neighbor.id];
      if (!candidate) {
        return null;
      }

      return {
        node: candidate,
        score: scoreDirectionalCandidate(
          node,
          neighbor,
          direction,
          sequentialIds[0] === candidate.id,
        ),
      };
    })
    .filter((entry): entry is { node: ExteriorTourNode; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score);

  const existingIds = new Set(ranked.map((entry) => entry.node.id));
  const extendedCandidates = graph.nodes
    .filter((candidate) => candidate.id !== node.id && !existingIds.has(candidate.id))
    .map((candidate) => ({
      node: candidate,
      score: scoreDirectionalVectorCandidate(
        node,
        candidate,
        direction,
        sequentialIds.includes(candidate.id),
      ),
    }))
    .filter((entry) => {
      if (direction === "forward" || direction === "backward") {
        return entry.score > -0.08;
      }

      return entry.score > 0;
    })
    .sort((a, b) => b.score - a.score);

  ranked.push(...extendedCandidates);

  const rankedIds = new Set(ranked.map((entry) => entry.node.id));
  for (const sequentialId of sequentialIds) {
    const candidate = graph.byId[sequentialId];
    if (!candidate || rankedIds.has(candidate.id)) {
      continue;
    }

    ranked.push({
      node: candidate,
      score: 0.12,
    });
  }

  return ranked.sort((a, b) => b.score - a.score);
}

export function getNavigationTargets(
  graph: ExteriorTourGraph,
  nodeId: string,
): DirectionalNavMap {
  return {
    forward: getDirectionalTarget(graph, nodeId, "forward"),
    left: getDirectionalTarget(graph, nodeId, "left"),
    right: getDirectionalTarget(graph, nodeId, "right"),
    backward: getDirectionalTarget(graph, nodeId, "backward"),
  };
}

export function getNodeHeading(node: ExteriorTourNode) {
  return Math.atan2(node.forward.y, node.forward.x);
}

export function preserveViewYawBetweenNodes(
  fromNode: ExteriorTourNode,
  toNode: ExteriorTourNode,
  currentYaw: number,
) {
  const worldHeading = getNodeHeading(fromNode) + currentYaw;
  return wrapAngleRad(worldHeading - getNodeHeading(toNode));
}

export function getWarmupNodeIds(graph: ExteriorTourGraph, nodeId: string) {
  const directionalTargets = getNavigationTargets(graph, nodeId);

  return [
    directionalTargets.forward.node?.id ?? null,
    directionalTargets.left.node?.id ?? null,
    directionalTargets.right.node?.id ?? null,
    directionalTargets.backward.node?.id ?? null,
    getSequentialNodeIds(graph, nodeId).nextId,
  ].filter((value): value is string => Boolean(value));
}
