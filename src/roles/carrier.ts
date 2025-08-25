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
      // 不管有没有携带资源，都可以帮忙移动
      const staticHarvesters = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'staticHarvester' &&
                       c.memory.targetId &&
                       c.getActiveBodyparts(MOVE) == 0 && // 只帮助没有 MOVE 部件的静态矿工
                       c.pos.getRangeTo(new RoomPosition(
                         parseInt(c.memory.targetId.split(',')[0]),
                         parseInt(c.memory.targetId.split(',')[1]),
                         c.room.name
                       )) > 1 // 距离目标位置>1格时才需要帮助
      });

      return staticHarvesters.length > 0;
    }

    // 帮助静态矿工移动到指定位置
    private static helpStaticHarvester(creep: Creep): void {
      const target = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: function(object) {
          return object.memory.role === 'staticHarvester' &&
                 object.memory.targetId &&
                 object.getActiveBodyparts(MOVE) === 0 &&
                 object.pos.getRangeTo(new RoomPosition(
                   parseInt(object.memory.targetId!.split(',')[0]),
                   parseInt(object.memory.targetId!.split(',')[1]),
                   object.room.name
                 )) > 1; // 距离目标位置>1格时才需要帮助
        }
      });

      if (target) {
        creep.say('🚶 帮助移动');

        const targetPos = new RoomPosition(
          parseInt(target.memory.targetId!.split(',')[0]),
          parseInt(target.memory.targetId!.split(',')[1]),
          target.room.name
        );

        // 检查目标位置是否已经被其他 creep 占用
        const creepsAtTarget = targetPos.lookFor(LOOK_CREEPS);
        const isTargetOccupied = creepsAtTarget.some(c => c.id !== target.id);

        if (isTargetOccupied) {
          // 目标位置被占用，寻找新的可用位置
          const newTargetPos = this.findAlternativeMiningSpot(target, targetPos);
          if (newTargetPos) {
            // 更新静态矿工的目标位置
            target.memory.targetId = `${newTargetPos.x},${newTargetPos.y}`;
            console.log(`静态矿工 ${target.name} 目标位置被占用，重新分配到: ${newTargetPos.x},${newTargetPos.y}`);
            return;
          } else {
            // 没有可用位置，等待
            creep.say('⏳ 等待位置');
            return;
          }
        }

        // 如果静态矿工已经距离目标位置≤1格，不需要帮助
        if (target.pos.getRangeTo(targetPos) <= 1) {
          return;
        }

        const pullResult = creep.pull(target);

        if (pullResult == ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#00ff00' } });
        } else if (pullResult == OK) {
          const targetMoveResult = target.move(creep);

          if (creep.pos.isEqualTo(targetPos)) {
            const freePosition = this.findFreePositionNearTarget(targetPos);
            if (freePosition) {
              creep.moveTo(freePosition, { visualizePathStyle: { stroke: '#ff0000' } });
            }
          } else {
            if (creep.pos.isNearTo(targetPos)) {
              const direction = target.pos.getDirectionTo(targetPos);

              if (direction !== TOP) {
                const targetMoveResult = target.move(direction);
                const carrierMoveResult = creep.move(direction);
              }
            } else {
              creep.moveTo(targetPos, {
                visualizePathStyle: { stroke: '#ffffff' }
              });
            }
          }
        }
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

      // 1. 优先收集矿点附近掉落的资源（静态矿工产生的）
      const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: (resource) => resource.resourceType === RESOURCE_ENERGY
      });

      if (droppedResources.length > 0) {
        // 优先选择矿点附近的掉落资源
        const sources = creep.room.find(FIND_SOURCES);
        if (sources.length > 0) {
          // 找到距离矿点最近的掉落资源
          let bestResource = droppedResources[0];
          let bestDistance = Infinity;

          for (const resource of droppedResources) {
            for (const source of sources) {
              const distance = resource.pos.getRangeTo(source);
              if (distance < bestDistance) {
                bestDistance = distance;
                bestResource = resource;
              }
            }
          }

          target = bestResource;
        } else {
          // 如果没有矿点，选择最近的掉落资源
          target = creep.pos.findClosestByPath(droppedResources);
        }
      }

      // 2. 从墓碑收集资源
      if (!target) {
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
  }
