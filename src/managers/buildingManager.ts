// 智能建筑布局管理器
export class BuildingLayoutManager {

  // 主入口：更新房间建筑布局
  public static updateBuildingLayout(room: Room): void {
    // 减少日志频率：每10个tick记录一次，或有实际建设时记录
    const shouldLog = Game.time % 10 === 0;

    if (shouldLog) {
      // console.log(`[建筑管理] 检查房间 ${room.name} 建筑布局`);
    }

    // 1. 优先建造矿点容器
    const containersBuilt = this.buildSourceContainers(room);

    // 2. 执行棋盘式布局建设
    const layoutBuilt = this.buildCheckerboardLayout(room);

    // 3. 建设主要道路网络
    const roadsBuilt = this.buildMainRoadNetwork(room);

    // 只有实际建设了东西或定期日志时才输出
    if (containersBuilt > 0 || layoutBuilt > 0 || roadsBuilt > 0 || shouldLog) {
      console.log(`[建筑管理] 房间 ${room.name} 完成建设: 容器${containersBuilt} 布局${layoutBuilt} 道路${roadsBuilt}`);
    }
  }

  // 建设棋盘式布局
  private static buildCheckerboardLayout(room: Room): number {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return 0; // 没有主城时返回0
    }

    // 计算当前建筑状态
    const currentConstructionSites = room.find(FIND_MY_CONSTRUCTION_SITES).length;

    // 限制建筑工地数量，避免过度建设
    if (currentConstructionSites >= 5) {
      if (Game.time % 50 === 0) { // 每50tick提醒一次
        // console.log(`[建筑管理] 建筑工地过多(${currentConstructionSites})，暂停新建`);
      }
      return 0; // 返回建设数量
    }

    let totalBuilt = 0;

    // 分层建设：逐层完成后再扩展
    for (let layer = 1; layer <= 8; layer++) {
      if (this.isLayerComplete(room, spawn.pos, layer - 1)) {
        // 前一层已完成，尝试建设当前层
        const built = this.buildLayer(room, spawn.pos, layer);
        totalBuilt += built;
        if (built > 0) {
          return totalBuilt; // 一次只建设一层
        }
      }
    }
    return totalBuilt;
  }

  // 检查某一层是否建设完成
  private static isLayerComplete(room: Room, center: RoomPosition, layer: number): boolean {
    if (layer === 0) return true; // 第0层（中心）总是完成的

    const layerPositions = this.getLayerPositions(center, layer);
    const currentExtensions = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION
    }).length;
    const maxExtensions = this.getMaxExtensionsForRCL(room.controller?.level || 1);

    for (const pos of layerPositions) {
      const pattern = this.getPositionPattern(center, pos);

      if (pattern === 'EXTENSION') {
        // Extension位置：只有在未达到RCL上限时才要求建造
        if (currentExtensions < maxExtensions) {
          const hasStructure = room.lookForAt(LOOK_STRUCTURES, pos).length > 0;
          const hasConstructionSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos).length > 0;

          if (!hasStructure && !hasConstructionSite) {
            return false; // Extension位置未完成
          }
        }
        // 如果Extension已达上限，跳过Extension位置的检查
      } else if (pattern === 'ROAD') {
        // Road位置：总是要求建造
        const hasStructure = room.lookForAt(LOOK_STRUCTURES, pos).length > 0;
        const hasConstructionSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos).length > 0;

        if (!hasStructure && !hasConstructionSite) {
          return false; // Road位置未完成
        }
      }
    }

    return true;
  }

  // 建设指定层
  private static buildLayer(room: Room, center: RoomPosition, layer: number): number {
    let builtCount = 0;
    const layerPositions = this.getLayerPositions(center, layer);

    for (const pos of layerPositions) {
      if (!this.isPositionInRoom(pos)) continue;

      const pattern = this.getPositionPattern(center, pos);

      if (this.canBuildAt(room, pos)) {
        let structureType: BuildableStructureConstant | null = null;

        if (pattern === 'EXTENSION') {
          const currentExtensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
          }).length;
          const maxExtensions = this.getMaxExtensionsForRCL(room.controller?.level || 1);

          if (currentExtensions < maxExtensions) {
            structureType = STRUCTURE_EXTENSION;
          }
        } else if (pattern === 'ROAD') {
          structureType = STRUCTURE_ROAD;
        }

        if (structureType) {
          const result = room.createConstructionSite(pos.x, pos.y, structureType);
          if (result === OK) {
            // console.log(`[建筑管理] 在 (${pos.x},${pos.y}) 创建${structureType}建筑工地`);
            builtCount++;
          }
        }
      }
    }

    return builtCount;
  }

  // 获取某层的所有位置
  private static getLayerPositions(center: RoomPosition, layer: number): RoomPosition[] {
    const positions: RoomPosition[] = [];

    for (let dx = -layer; dx <= layer; dx++) {
      for (let dy = -layer; dy <= layer; dy++) {
        // 只取该层的边界位置，不包括内层
        if (Math.abs(dx) === layer || Math.abs(dy) === layer) {
          positions.push(new RoomPosition(
            center.x + dx,
            center.y + dy,
            center.roomName
          ));
        }
      }
    }

    return positions;
  }

  // 根据位置确定应该建造什么（正确的棋盘模式 - 确保每个extension上下左右都有道路）
  private static getPositionPattern(center: RoomPosition, pos: RoomPosition): string {
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;

    // 标准棋盘模式：确保每个extension的上下左右都有道路通道
    // 使用曼哈顿距离的奇偶性来决定
    const manhattanDistance = Math.abs(dx) + Math.abs(dy);

    // 棋盘模式：曼哈顿距离为奇数的位置建道路，偶数的位置建extension
    // 这样能确保每个extension的上、下、左、右四个相邻位置都是道路
    if (manhattanDistance % 2 === 1) {
      return 'ROAD';
    } else {
      return 'EXTENSION';
    }
  }

  // 检查位置是否可以建造
  private static canBuildAt(room: Room, pos: RoomPosition): boolean {
    if (!this.isPositionInRoom(pos)) return false;

    // 检查地形
    const terrain = Game.map.getRoomTerrain(room.name);
    if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
      return false;
    }

    // 检查是否已有建筑
    const structures = room.lookForAt(LOOK_STRUCTURES, pos);
    if (structures.length > 0) {
      return false;
    }

    // 检查是否已有建筑工地
    const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
    if (sites.length > 0) {
      return false;
    }

    return true;
  }

  // 检查位置是否在房间范围内
  private static isPositionInRoom(pos: RoomPosition): boolean {
    return pos.x >= 1 && pos.x <= 48 && pos.y >= 1 && pos.y <= 48;
  }

  // 根据RCL获取最大Extension数量
  private static getMaxExtensionsForRCL(rcl: number): number {
    const extensionLimits = [0, 0, 5, 10, 20, 30, 40, 50, 60];
    return extensionLimits[Math.min(rcl, 8)] || 0;
  }

  // 建设矿点容器 - 优化版本使用miningSpots
  private static buildSourceContainers(room: Room): number {
    const roomMemory = Memory.rooms[room.name];
    if (!roomMemory || !roomMemory.miningSpots) {
      console.log(`[建筑管理] 房间 ${room.name} 没有miningSpots数据，跳过容器规划`);
      return 0;
    }

    const sources = room.find(FIND_SOURCES);
    const containers = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER
    });

    // console.log(`[建筑管理] 当前有 ${containers.length} 个容器，${sources.length} 个矿点`);

    // 为每个矿点最多建造一个容器
    if (containers.length < sources.length) {
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];

        // 检查该矿点是否已有容器或正在建造的容器
        const nearbyContainer = containers.find(c => c.pos.isNearTo(source));
        const nearbyConstructionSite = room.find(FIND_MY_CONSTRUCTION_SITES, {
          filter: site => site.structureType === STRUCTURE_CONTAINER && site.pos.isNearTo(source)
        });

        if (!nearbyContainer && nearbyConstructionSite.length === 0) {
          // 从miningSpots获取最优位置
          const containerPos = this.getContainerPositionFromMiningSpots(room, source, i);
          if (containerPos) {
            const result = room.createConstructionSite(containerPos.x, containerPos.y, STRUCTURE_CONTAINER);
            if (result === OK) {
              // console.log(`[建筑管理] 在矿点${i} (${source.pos.x},${source.pos.y}) 的最优位置 (${containerPos.x},${containerPos.y}) 创建容器`);
              return 1; // 一次只建一个
            } else {
              // console.log(`[建筑管理] 创建容器失败: ${result}`);
            }
          }
        }
      }
    }
    return 0; // 没有建造任何容器
  }

  // 从miningSpots为指定矿点获取预计算的最优容器位置
  private static getContainerPositionFromMiningSpots(room: Room, source: Source, sourceIndex: number): RoomPosition | null {
    const roomMemory = Memory.rooms[room.name];
    if (!roomMemory || !roomMemory.miningSpots || roomMemory.miningSpots.length === 0) {
      console.log(`[建筑管理] miningSpots数据为空，回退到传统方法`);
      return this.findBestContainerPositionFallback(room, source);
    }

    // miningSpots现在按矿点顺序存储，直接取对应索引的位置
    if (sourceIndex < roomMemory.miningSpots.length) {
      const spotStr = roomMemory.miningSpots[sourceIndex];

      try {
        const [x, y] = spotStr.split(',').map(Number);
        const pos = new RoomPosition(x, y, room.name);

        // 验证位置确实与当前矿点相邻且可建造
        if (pos.isNearTo(source) && this.canBuildAt(room, pos)) {
          // console.log(`[建筑管理] 使用预计算的矿点${sourceIndex}最优容器位置: (${x},${y})`);
          return pos;
        } else {
          // console.log(`[建筑管理] 预计算位置(${x},${y})不可用，矿点${sourceIndex}使用传统方法`);
        }
      } catch (error) {
        // console.log(`[建筑管理] 解析矿点${sourceIndex}的miningSpot位置失败: ${spotStr}`);
      }
    } else {
      // console.log(`[建筑管理] 矿点索引${sourceIndex}超出miningSpots范围(${roomMemory.miningSpots.length})`);
    }

    // 如果预计算位置不可用，回退到传统方法
    return this.findBestContainerPositionFallback(room, source);
  }

  // 备用容器位置查找方法（保留原逻辑作为后备）
  private static findBestContainerPositionFallback(room: Room, source: Source): RoomPosition | null {
    const positions: RoomPosition[] = [];

    // 在矿点周围找到所有可用位置
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // 跳过矿点本身

        const pos = new RoomPosition(source.pos.x + dx, source.pos.y + dy, room.name);
        if (this.canBuildAt(room, pos)) {
          positions.push(pos);
        }
      }
    }

    if (positions.length === 0) return null;

    // 选择距离spawn最近的位置
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (spawn) {
      return positions.reduce((best, current) => {
        const bestDist = best.getRangeTo(spawn);
        const currentDist = current.getRangeTo(spawn);
        return currentDist < bestDist ? current : best;
      });
    }

    return positions[0];
  }

  // 建设主要道路网络
  private static buildMainRoadNetwork(room: Room): number {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return 0;

    let roadsBuilt = 0;

    const controller = room.controller;
    const sources = room.find(FIND_SOURCES);

    // 建设到控制器的道路
    if (controller && spawn.pos.getRangeTo(controller) > 3) {
      this.buildRoadToTarget(room, spawn.pos, controller.pos, 'controller');
    }

    // 建设到各个矿点的道路
    for (const source of sources) {
      if (spawn.pos.getRangeTo(source) > 3) {
        this.buildRoadToTarget(room, spawn.pos, source.pos, 'source');
      }
    }
    return roadsBuilt;
  }

  // 建设到目标的道路
  private static buildRoadToTarget(room: Room, from: RoomPosition, to: RoomPosition, targetType: string): void {
    const path = from.findPathTo(to, {
      ignoreCreeps: true,
      swampCost: 1,
      plainCost: 1
    });

    if (path.length === 0) return;

    // 只建设路径的一部分，避免过度建设
    const segmentLength = Math.min(path.length, 5);
    let builtCount = 0;

    for (let i = 0; i < segmentLength && builtCount < 2; i++) {
      const step = path[i];
      const pos = new RoomPosition(step.x, step.y, room.name);

      if (this.shouldBuildRoadAt(room, pos)) {
        const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
        if (result === OK) {
          console.log(`[建筑管理] 在通往${targetType}的路径上建设道路 (${pos.x},${pos.y})`);
          builtCount++;
        }
      }
    }
  }

  // 判断是否应该在此位置建设道路
  private static shouldBuildRoadAt(room: Room, pos: RoomPosition): boolean {
    if (!this.canBuildAt(room, pos)) return false;

    // 不在棋盘布局区域内建设道路（那里有自己的道路规划）
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (spawn && spawn.pos.getRangeTo(pos) <= 8) {
      return false; // 棋盘布局会处理这个区域
    }

    return true;
  }
}

// 兼容性导出函数（保持向后兼容）
export function updateBuildingLayout(room: Room): void {
  BuildingLayoutManager.updateBuildingLayout(room);
}

// 更新道路规划（兼容性函数）
export function updateRoadPlanning(_room: Room): void {
  // 现在由BuildingLayoutManager.buildMainRoadNetwork处理
  // 移除重复日志输出
}
