// 更新房间的建筑布局建议
export function updateBuildingLayout(room: Room): void {
  const sources = room.find(FIND_SOURCES);
  const extensions = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_EXTENSION
  });
  const containers = room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER
  });

  // 优先建造 Container（放在矿点周围，帮助收集资源）
  if (containers.length < sources.length) {
    const bestPos = findBestContainerPosition(room);
    if (bestPos) {
      room.createConstructionSite(bestPos.x, bestPos.y, STRUCTURE_CONTAINER);
    }
  }

  // 然后建造 Extension（贴着主城斜向扩展）
  if (extensions.length < 5) { // 限制 Extension 数量，避免过度拥挤
    const bestPos = findBestExtensionPosition(room);
    if (bestPos) {
      room.createConstructionSite(bestPos.x, bestPos.y, STRUCTURE_EXTENSION);
    }
  }
}

// 寻找扩展的最佳位置（贴着主城斜向扩展）
function findBestExtensionPosition(room: Room): RoomPosition | null {
  const spawns = room.find(FIND_MY_SPAWNS);
  if (spawns.length === 0) return null;

  const spawn = spawns[0]; // 使用第一个 spawn 作为参考点

  // 定义棋盘式斜向扩展的偏移量（#代表主城，x代表extension）
  // |---|----|----|----|----|
  // |x| |x| |x|
  // | |x| |x| |
  // |x| |#| |x|
  // | |x| |x| |
  // |x| |x| |x|
  const chessboardOffsets = [
    // 第一层：紧贴 spawn 的 4 个对角位置
    { x: -1, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 1 },  { x: 1, y: 1 },

    // 第二层：向外扩展的 8 个位置
    { x: -2, y: -2 }, { x: 0, y: -2 }, { x: 2, y: -2 },
    { x: -2, y: 0 },                    { x: 2, y: 0 },
    { x: -2, y: 2 },  { x: 0, y: 2 },  { x: 2, y: 2 },

    // 第三层：最外层的 4 个位置
    { x: -3, y: -1 }, { x: 3, y: -1 },
    { x: -3, y: 1 },  { x: 3, y: 1 }
  ];

  // 按照棋盘式布局顺序寻找可用位置
  for (const offset of chessboardOffsets) {
    const x = spawn.pos.x + offset.x;
    const y = spawn.pos.y + offset.y;

    if (x >= 0 && x < 50 && y >= 0 && y < 50) {
      const pos = new RoomPosition(x, y, room.name);

      // 检查位置是否可用
      const creepsAtPos = room.lookForAt(LOOK_CREEPS, pos);
      const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, pos);
      const constructionSitesAtPos = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);

      if (creepsAtPos.length === 0 &&
          structuresAtPos.length === 0 &&
          constructionSitesAtPos.length === 0) {
        return pos; // 返回第一个可用的位置，确保有序扩展
      }
    }
  }

  return null;
}

// 寻找容器的最佳位置（放在矿点周围）
function findBestContainerPosition(room: Room): RoomPosition | null {
  const sources = room.find(FIND_SOURCES);
  if (sources.length === 0) return null;

  // 为每个矿点寻找最佳的 Container 位置
  for (const source of sources) {
    const positions: RoomPosition[] = [];

    // 在矿点周围 2 格范围内寻找位置
    for (let x = source.pos.x - 2; x <= source.pos.x + 2; x++) {
      for (let y = source.pos.y - 2; y <= source.pos.y + 2; y++) {
        if (x >= 0 && x < 50 && y >= 0 && y < 50) {
          const pos = new RoomPosition(x, y, room.name);

          // 检查位置是否合适
          if (pos.isNearTo(source) && !pos.isEqualTo(source.pos)) {
            const creepsAtPos = room.lookForAt(LOOK_CREEPS, pos);
            const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, pos);
            const constructionSitesAtPos = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);

            if (creepsAtPos.length === 0 &&
                structuresAtPos.length === 0 &&
                constructionSitesAtPos.length === 0) {
              positions.push(pos);
            }
          }
        }
      }
    }

    if (positions.length > 0) {
      // 选择距离矿点最近的位置
      return positions.reduce((best, current) => {
        return current.getRangeTo(source) < best.getRangeTo(source) ? current : best;
      });
    }
  }

  return null;
}

// 更新道路规划
export function updateRoadPlanning(room: Room): void {
  // 分析 Creep 移动路径，找出高频路径
  const highTrafficPaths = analyzeCreepMovement(room);

  // 为高频路径建造道路
  for (const path of highTrafficPaths) {
    if (shouldBuildRoad(room, path)) {
      room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
    }
  }
}

// 分析 Creep 移动路径
function analyzeCreepMovement(room: Room): RoomPosition[] {
  const creeps = room.find(FIND_MY_CREEPS);
  const pathCounts = new Map<string, number>();

  // 统计每个位置的访问频率
  for (const creep of creeps) {
    if (creep.memory.lastPos) {
      const path = getPathBetween(creep.memory.lastPos, creep.pos);
      for (const pos of path) {
        const key = `${pos.x},${pos.y}`;
        pathCounts.set(key, (pathCounts.get(key) || 0) + 1);
      }
    }

    // 记录当前位置
    creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
  }

  // 找出高频路径（访问次数 > 3 的位置）
  const highTrafficPositions: RoomPosition[] = [];
  for (const [key, count] of pathCounts) {
    if (count > 3) {
      const [x, y] = key.split(',').map(Number);
      highTrafficPositions.push(new RoomPosition(x, y, room.name));
    }
  }

  return highTrafficPositions;
}

// 获取两点间的路径
function getPathBetween(from: { x: number, y: number }, to: RoomPosition): RoomPosition[] {
  const path: RoomPosition[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);

  let currentX = from.x;
  let currentY = from.y;

  // 简单的直线路径算法
  while (currentX !== to.x || currentY !== to.y) {
    if (currentX !== to.x) {
      currentX += dx;
      path.push(new RoomPosition(currentX, currentY, to.roomName));
    }
    if (currentY !== to.y) {
      currentY += dy;
      path.push(new RoomPosition(currentX, currentY, to.roomName));
    }
  }

  return path;
}

// 判断是否应该建造道路
function shouldBuildRoad(room: Room, position: RoomPosition): boolean {
  // 检查位置是否已经有道路
  const structures = room.lookForAt(LOOK_STRUCTURES, position);
  if (structures.some(s => s.structureType === STRUCTURE_ROAD)) {
    return false;
  }

  // 检查位置是否被其他建筑占用
  if (structures.length > 0) {
    return false;
  }

  // 检查位置是否被 Creep 占用
  const creeps = room.lookForAt(LOOK_CREEPS, position);
  if (creeps.length > 0) {
    return false;
  }

  // 检查是否有足够的能量建造道路
  if (room.energyAvailable < 300) {
    return false;
  }

  return true;
}
