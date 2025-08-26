export class RoleCarrier {
    public static run(creep: Creep): void {
      // 状态切换逻辑
      if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
        creep.memory.working = false;
        creep.say('📦 收集');
        delete creep.memory.targetId;
      }

      if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        creep.say('🚚 运输');
        delete creep.memory.targetId;
      }

      // 优先检查是否需要帮助静态矿工移动
      if (this.shouldHelpStaticHarvester(creep)) {
        this.helpStaticHarvester(creep);
        return;
      }

      if (creep.memory.working) {
        // 运输模式：将资源运输到需要的地方
        this.deliverResources(creep);
      } else {
        // 收集模式：从地面或容器收集资源
        this.collectResources(creep);
      }
    }

    // 检查是否需要帮助静态矿工移动
    private static shouldHelpStaticHarvester(creep: Creep): boolean {
      // 检查是否已经有其他运输工在帮助移动
      const helpingCarriers = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'carrier' &&
                       c.id !== creep.id &&
                       c.memory.helpingStaticHarvester // 检查其他运输工是否在帮助
      });

      // 如果已经有运输工在帮助移动，这个运输工就不需要帮忙了
      if (helpingCarriers.length > 0) {
        return false;
      }

      // 检查是否有需要帮助的静态矿工（working !== true）
      const staticHarvesters = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'staticHarvester' &&
                       c.memory.targetId &&
                       c.getActiveBodyparts(MOVE) == 0 && // 只帮助没有 MOVE 部件的静态矿工
                       c.memory.working !== true // 检查working状态
      });

      return staticHarvesters.length > 0;
    }

    // 帮助静态矿工移动到指定位置
    private static helpStaticHarvester(creep: Creep): void {
      // 如果已经有帮助的矿工，继续帮助同一个
      if (creep.memory.helpingStaticHarvester) {
        const target = Game.creeps[creep.memory.helpingStaticHarvester];
        if (target && target.memory.role === 'staticHarvester') {
          // 检查矿工是否已经到达目标位置
          if (target.memory.working === true) {
            // 矿工已经到达，清除帮助状态，寻找下一个
            delete creep.memory.helpingStaticHarvester;
            return;
          }
          // 继续帮助这个矿工
          this.assistStaticHarvester(creep, target);
          return;
        }
      }

      // 寻找新的需要帮助的矿工
      const target = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: function(object) {
          return object.memory.role === 'staticHarvester' &&
                 object.memory.targetId &&
                 object.getActiveBodyparts(MOVE) === 0 &&
                 object.memory.working !== true;
        }
      });

      if (target) {
        // 记录要帮助的矿工名字
        creep.memory.helpingStaticHarvester = target.name;
        creep.say('🚶 帮助移动');
        this.assistStaticHarvester(creep, target);
      }
    }

    // 协助静态矿工移动
    private static assistStaticHarvester(creep: Creep, target: Creep): void {
      const targetPos = new RoomPosition(
        parseInt(target.memory.targetId!.split(',')[0]),
        parseInt(target.memory.targetId!.split(',')[1]),
        target.room.name
      );

      // 检查目标位置是否已经被其他矿工占用，或者位置本身不可用
      const creepsAtTarget = targetPos.lookFor(LOOK_CREEPS);
      const isTargetOccupied = creepsAtTarget.some(c => c.id !== target.id && c.memory.role === 'staticHarvester');

      // 检查目标位置本身是否可用（没有建筑、不是地形墙、没有爬爬、没有建筑工地）
      const structuresAtTarget = targetPos.lookFor(LOOK_STRUCTURES);
      const terrainAtTarget = targetPos.lookFor(LOOK_TERRAIN);
      const isTerrainWall = terrainAtTarget[0] === 'wall';
      const constructionSitesAtTarget = targetPos.lookFor(LOOK_CONSTRUCTION_SITES);

      const isTargetUnavailable = isTargetOccupied ||
                                  isTerrainWall ||
                                  structuresAtTarget.length > 0 ||
                                  creepsAtTarget.length > 0 ||
                                  constructionSitesAtTarget.length > 0;

      if (isTargetUnavailable) {
        // 目标位置不可用，寻找新位置
        if (isTargetOccupied) {
          console.log(`目标位置 (${targetPos.x},${targetPos.y}) 已被其他矿工占用，寻找新位置`);
        } else if (isTerrainWall) {
          console.log(`目标位置 (${targetPos.x},${targetPos.y}) 是地形墙，寻找新位置`);
        } else if (structuresAtTarget.length > 0) {
          console.log(`目标位置 (${targetPos.x},${targetPos.y}) 有建筑，寻找新位置`);
        } else if (creepsAtTarget.length > 0) {
          console.log(`目标位置 (${targetPos.x},${targetPos.y}) 有爬爬，寻找新位置`);
        } else if (constructionSitesAtTarget.length > 0) {
          console.log(`目标位置 (${targetPos.x},${targetPos.y}) 有建筑工地，寻找新位置`);
        }

        const availableMiningSpot = this.findAvailableMiningSpot(target);
        if (availableMiningSpot) {
          // 更新静态矿工的目标位置
          target.memory.targetId = `${availableMiningSpot.x},${availableMiningSpot.y}`;
          console.log(`矿工 ${target.name} 重新分配到新位置: (${availableMiningSpot.x},${availableMiningSpot.y})`);
          // 更新目标位置
          targetPos.x = availableMiningSpot.x;
          targetPos.y = availableMiningSpot.y;
          targetPos.roomName = availableMiningSpot.roomName;
        } else {
          // 没有可用位置，等待
          creep.say('⏳ 等待位置');
          console.log(`矿工 ${target.name} 没有可用位置，等待中`);
          return;
        }
      }

      // 检查运输兵是否已经到达矿点附近（isNearTo）
      if (creep.pos.isNearTo(targetPos)) {
        // 已经到达矿点附近，执行交换位置
        creep.say('🔄 交换位置');
        console.log(`运输兵 ${creep.name} 到达目标位置 (${targetPos.x},${targetPos.y})，与矿工 ${target.name} 交换位置`);

        // 执行真正的交换位置
        const pullResult = creep.pull(target);
        if (pullResult == OK) {
          console.log(`运输兵 ${creep.name} 开始与矿工 ${target.name} 交换位置`);

          // 记录矿工的原位置
          const targetOriginalPos = target.pos;

          // 让矿工移动到运输兵位置（目标位置）
          const moveResult = target.move(creep);
          if (moveResult == OK) {
            // 矿工成功移动，现在运输兵移动到矿工的原位置
            console.log(`矿工 ${target.name} 移动到目标位置 (${targetPos.x},${targetPos.y})，运输兵移动到位置 (${targetOriginalPos.x},${targetOriginalPos.y})`);
            creep.moveTo(targetOriginalPos, { visualizePathStyle: { stroke: '#ff0000' } });

            // 等待一轮，让位置交换完成
            creep.say('⏳ 交换中');
          } else {
            // 矿工移动失败，继续协助
            creep.say('⚠️ 移动失败');
            console.log(`矿工 ${target.name} 移动失败，结果: ${moveResult}`);
          }
        } else if (pullResult == ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#00ff00' } });
        }
        return;
      }

      // 还没到达矿点附近，走一步矿工跟一步
      const distanceToTarget = creep.pos.getRangeTo(targetPos);
      creep.say(`🚶 前往目标 (${targetPos.x},${targetPos.y}) 距离: ${distanceToTarget}格`);
      console.log(`运输兵 ${creep.name} 协助矿工 ${target.name} 前往目标位置 (${targetPos.x},${targetPos.y})，当前距离: ${distanceToTarget}格`);

      // 先移动到矿工附近
      if (creep.pos.getRangeTo(target) > 1) {
        console.log(`运输兵 ${creep.name} 距离矿工太远 (${creep.pos.getRangeTo(target)}格)，移动到矿工附近`);
        creep.moveTo(target, { visualizePathStyle: { stroke: '#00ff00' } });
        return;
      }

      // 在矿工附近，执行pull和移动
      console.log(`运输兵 ${creep.name} 在矿工附近，执行pull和移动`);
      const pullResult = creep.pull(target);

      if (pullResult == OK) {
        target.move(creep);
        // 运输兵向目标位置移动一步
        console.log(`运输兵 ${creep.name} pull成功，矿工 ${target.name} 跟随，运输兵向目标位置 (${targetPos.x},${targetPos.y}) 移动`);
        creep.moveTo(targetPos, { visualizePathStyle: { stroke: '#00ff00' } });
      } else if (pullResult == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#00ff00' } });
      }
    }

    // 在目标附近寻找空闲位置
    private static findFreePositionNearTarget(targetPos: RoomPosition): RoomPosition | null {
      // 检查目标周围的8个位置
      const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];

      for (const direction of directions) {
        const dx = [0, 0, 1, 1, 1, 0, -1, -1, -1];
        const dy = [0, -1, -1, 0, 1, 1, 1, 0, -1];

        const newX = targetPos.x + dx[direction];
        const newY = targetPos.y + dy[direction];

        if (newX >= 0 && newX < 50 && newY >= 0 && newY < 50) {
          const testPos = new RoomPosition(newX, newY, targetPos.roomName);

          // 检查位置是否被占用
          const creepsAtPos = testPos.lookFor(LOOK_CREEPS);
          const structuresAtPos = testPos.lookFor(LOOK_STRUCTURES);
          if (creepsAtPos.length === 0 && structuresAtPos.length === 0) {
            return testPos;
          }
        }
      }

      return null;
    }

    // 寻找替代的采矿点
    private static findAlternativeMiningSpot(staticHarvester: Creep, originalPos: RoomPosition): RoomPosition | null {
      const sources = staticHarvester.room.find(FIND_SOURCES);
      if (sources.length === 0) return null;

      // 寻找距离矿点最近的可用位置
      for (const source of sources) {
        // 在矿点周围 2 格范围内寻找位置
        for (let x = source.pos.x - 2; x <= source.pos.x + 2; x++) {
          for (let y = source.pos.y - 2; y <= source.pos.y + 2; y++) {
            if (x >= 0 && x < 50 && y >= 0 && y < 50) {
              const pos = new RoomPosition(x, y, staticHarvester.room.name);

              // 检查位置是否合适
              if (pos.isNearTo(source) && !pos.isEqualTo(source.pos)) {
                const creepsAtPos = pos.lookFor(LOOK_CREEPS);
                const structuresAtPos = pos.lookFor(LOOK_STRUCTURES);
                const constructionSitesAtPos = pos.lookFor(LOOK_CONSTRUCTION_SITES);

                if (creepsAtPos.length === 0 &&
                    structuresAtPos.length === 0 &&
                    constructionSitesAtPos.length === 0) {
                  return pos;
                }
              }
            }
          }
        }
      }

      return null;
    }

    // 收集资源
    private static collectResources(creep: Creep): void {
      let target: Resource | Structure | Ruin | null = null;

      // 1. 优先从墓碑收集资源
      const tombstones = creep.room.find(FIND_TOMBSTONES, {
        filter: (tombstone) => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      });

      if (tombstones.length > 0) {
        const closestTombstone = creep.pos.findClosestByPath(tombstones);
        if (closestTombstone) {
          const result = creep.withdraw(closestTombstone, RESOURCE_ENERGY);
          if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(closestTombstone, {
              visualizePathStyle: { stroke: '#ffaa00' }
            });
          } else if (result === OK) {
            creep.say('🪦');
          }
          return; // 直接返回，不执行后续逻辑
        }
      }

      // 2. 优先收集地上的资源
      const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: (resource) => resource.resourceType === RESOURCE_ENERGY
      });

      if (droppedResources.length > 0) {
        // 选择最近的掉落资源
        target = creep.pos.findClosestByPath(droppedResources);
      }

      // 3. 从废墟收集资源
      if (!target) {
        const ruins = creep.room.find(FIND_RUINS, {
          filter: (ruin) => ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        });

        if (ruins.length > 0) {
          target = creep.pos.findClosestByPath(ruins);
        }
      }

      // 4. 从满载的容器收集
      if (!target) {
        const containers = creep.room.find(FIND_STRUCTURES, {
          filter: (structure) => {
            return (structure.structureType === STRUCTURE_CONTAINER ||
                    structure.structureType === STRUCTURE_STORAGE) &&
                   structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
          }
        });

        if (containers.length > 0) {
          target = creep.pos.findClosestByPath(containers);
        }
      }

      // 执行收集
      if (target) {
        let result: number;

        if (target instanceof Resource) {
          result = creep.pickup(target);
        } else if (target instanceof Ruin) {
          result = creep.withdraw(target, RESOURCE_ENERGY);
        } else {
          result = creep.withdraw(target, RESOURCE_ENERGY);
        }

        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ffaa00' }
          });
        } else if (result === OK) {
          creep.say('📦');
        }
      } else {
        // 如果没有可收集的资源，尝试帮助静态矿工移动
        if (this.shouldHelpStaticHarvester(creep)) {
          this.helpStaticHarvester(creep);
        } else {
          creep.say('等待任务');
          // 原地等待，不移动到控制器
        }
      }
    }

    // 运输资源
    private static deliverResources(creep: Creep): void {
      let target: Structure | ConstructionSite | null = null;

      // 1. 优先运输到 Spawn 和 Extension
      const energyStructures = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType === STRUCTURE_SPAWN ||
                  structure.structureType === STRUCTURE_EXTENSION) &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (energyStructures.length > 0) {
        target = creep.pos.findClosestByPath(energyStructures);
      }

      // 2. 运输到容器
      if (!target) {
        const containers = creep.room.find(FIND_STRUCTURES, {
          filter: (structure) => {
            return (structure.structureType === STRUCTURE_CONTAINER ||
                    structure.structureType === STRUCTURE_STORAGE) &&
                   structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
          }
        });

        if (containers.length > 0) {
          target = creep.pos.findClosestByPath(containers);
        }
      }

      // 3. 运输到建筑工地
      if (!target) {
        const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
        if (constructionSites.length > 0) {
          target = creep.pos.findClosestByPath(constructionSites);
        }
      }

      // 4. 运输到控制器
      if (!target && creep.room.controller) {
        target = creep.room.controller;
      }

      // 执行运输
      if (target) {
        let result: number;

        if (target instanceof ConstructionSite) {
          result = creep.build(target);
        } else if (target instanceof StructureController) {
          result = creep.upgradeController(target);
        } else {
          result = creep.transfer(target, RESOURCE_ENERGY);
        }

        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ffffff' }
          });
        } else if (result === OK) {
          creep.say('🚚');
        }
      } else {
        // 如果没有运输目标，尝试帮助静态矿工移动
        if (this.shouldHelpStaticHarvester(creep)) {
          this.helpStaticHarvester(creep);
        } else {
          creep.say('等待任务');
          // 原地等待，不移动到控制器
        }
      }
    }

    // 寻找可用的矿点
    private static findAvailableMiningSpot(staticHarvester: Creep): RoomPosition | null {
      // 获取房间内存中的采矿点信息
      const roomMemory = Memory.rooms[staticHarvester.room.name];
      if (!roomMemory || !roomMemory.miningSpots || roomMemory.miningSpots.length === 0) {
        console.log(`房间 ${staticHarvester.room.name} 没有采矿点信息`);
        return null;
      }

      // 遍历所有矿点，找到第一个有可用位置的矿点
      for (const miningSpotStr of roomMemory.miningSpots) {
        const [spotX, spotY] = miningSpotStr.split(',').map(Number);
        const miningSpot = new RoomPosition(spotX, spotY, staticHarvester.room.name);

        console.log(`检查矿点 ${spotX},${spotY} ±1范围内是否有空位`);

        // 检查矿点±1范围内的所有位置
        for (let x = spotX - 1; x <= spotX + 1; x++) {
          for (let y = spotY - 1; y <= spotY + 1; y++) {
            if (x >= 0 && x < 50 && y >= 0 && y < 50) {
              const testPos = new RoomPosition(x, y, staticHarvester.room.name);

              // 检查位置是否有建筑
              const structuresAtPos = staticHarvester.room.lookForAt(LOOK_STRUCTURES, testPos);

              // 检查位置的地形
              const terrainAtPos = staticHarvester.room.lookForAt(LOOK_TERRAIN, testPos);
              const isTerrainWall = terrainAtPos[0] === 'wall';

              // 如果是地形墙，直接跳过
              if (isTerrainWall) {
                continue;
              }

              // 如果有建筑，跳过
              if (structuresAtPos.length > 0) {
                continue;
              }

              // 没有建筑且不是地形墙的情况下，检查是否有爬爬或建筑工地
              const creepsAtPos = staticHarvester.room.lookForAt(LOOK_CREEPS, testPos);
              const constructionSitesAtPos = staticHarvester.room.lookForAt(LOOK_CONSTRUCTION_SITES, testPos);

              if (creepsAtPos.length === 0 &&
                  constructionSitesAtPos.length === 0) {
                console.log(`矿点 ${spotX},${spotY} ±1范围内找到可用位置: ${testPos.x},${testPos.y}`);
                return testPos;
              }
            }
          }
        }

        console.log(`矿点 ${spotX},${spotY} ±1范围内没有可用位置`);
      }

      console.log(`所有矿点都没有可用位置`);
      return null;
    }
  }
