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

      if (creep.memory.working) {
        // 运输模式：将资源运输到需要的地方
        this.deliverResources(creep);
      } else {
        // 收集模式：从地面或容器收集资源
        this.collectResources(creep);
      }
    }

    private static collectResources(creep: Creep): void {
      let target: Resource | Structure | Tombstone | Ruin | null = null;

      // 1. 优先拾取地面掉落的资源
      const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES);
      if (droppedResources.length > 0) {
        // 优先拾取能量，其次是其他资源
        const energyResources = droppedResources.filter(r => r.resourceType === RESOURCE_ENERGY);
        if (energyResources.length > 0) {
          target = creep.pos.findClosestByPath(energyResources);
        } else {
          target = creep.pos.findClosestByPath(droppedResources);
        }
      }

      // 2. 从墓碑中收集资源
      if (!target) {
        const tombstones = creep.room.find(FIND_TOMBSTONES, {
          filter: (tombstone) => tombstone.store.getUsedCapacity() > 0
        });

        if (tombstones.length > 0) {
          target = creep.pos.findClosestByPath(tombstones);
        }
      }

      // 3. 从废墟中收集资源
      if (!target) {
        const ruins = creep.room.find(FIND_RUINS, {
          filter: (ruin) => ruin.store.getUsedCapacity() > 0
        });

        if (ruins.length > 0) {
          target = creep.pos.findClosestByPath(ruins) as Ruin;
        }
      }

      // 4. 从满载的容器中转移资源
      if (!target) {
        const fullContainers = creep.room.find(FIND_STRUCTURES, {
          filter: (structure) => {
            return structure.structureType === STRUCTURE_CONTAINER &&
                   structure.store.getUsedCapacity() > structure.store.getCapacity() * 0.8;
          }
        });

        if (fullContainers.length > 0) {
          target = creep.pos.findClosestByPath(fullContainers);
        }
      }

      // 执行收集
      if (target) {
        let result: number = ERR_NOT_FOUND;

        if (target instanceof Resource) {
          result = creep.pickup(target);
        } else if (target instanceof Tombstone || target instanceof Ruin) {
          // 从墓碑或废墟中取出所有资源
          for (const resourceType in target.store) {
            result = creep.withdraw(target, resourceType as ResourceConstant);
            if (result === OK) break;
          }
        } else if (target instanceof Structure && 'store' in target) {
          // 从容器中优先取能量
          if ((target as any).store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            result = creep.withdraw(target, RESOURCE_ENERGY);
          } else {
            // 取其他资源
            for (const resourceType in (target as any).store) {
              result = creep.withdraw(target, resourceType as ResourceConstant);
              if (result === OK) break;
            }
          }
        }

        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ffaa00' }
          });
        }
      } else {
        // 如果没有任务，就在房间中央待机
        const centerFlag = creep.room.find(FIND_FLAGS, {
          filter: flag => flag.name === 'Center'
        })[0];

        if (centerFlag) {
          creep.moveTo(centerFlag);
        } else if (creep.room.controller) {
          creep.moveTo(creep.room.controller);
        }
      }
    }

    private static deliverResources(creep: Creep): void {
      let target: Structure | null = null;

      // 获取 Creep 携带的主要资源类型
      const carriedResources = Object.keys(creep.store) as ResourceConstant[];
      const primaryResource = carriedResources[0] || RESOURCE_ENERGY;

      if (primaryResource === RESOURCE_ENERGY) {
        // 能量的分发优先级
        target = this.findEnergyTarget(creep);
      } else {
        // 其他资源的存储
        target = this.findStorageTarget(creep, primaryResource);
      }

      // 执行运输
      if (target) {
        const result = creep.transfer(target, primaryResource);

        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ffffff' }
          });
        } else if (result === OK) {
          creep.say('📤');
        }
      } else {
        // 如果没有目标，就在控制器附近等待
        if (creep.room.controller) {
          creep.moveTo(creep.room.controller);
        }
      }
    }

    private static findEnergyTarget(creep: Creep): Structure | null {
      // 能量分发优先级：Spawn > Extension > Tower > Container/Storage

      // 1. Spawn（生产单位）
      const spawns = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return structure.structureType === STRUCTURE_SPAWN &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (spawns.length > 0) {
        return creep.pos.findClosestByPath(spawns);
      }

      // 2. Extension（扩展）
      const extensions = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return structure.structureType === STRUCTURE_EXTENSION &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (extensions.length > 0) {
        return creep.pos.findClosestByPath(extensions);
      }

      // 3. Tower（防御塔）
      const towers = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return structure.structureType === STRUCTURE_TOWER &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (towers.length > 0) {
        return creep.pos.findClosestByPath(towers);
      }

      // 4. Container 或 Storage
      const storage = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType === STRUCTURE_CONTAINER ||
                  structure.structureType === STRUCTURE_STORAGE) &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (storage.length > 0) {
        return creep.pos.findClosestByPath(storage);
      }

      return null;
    }

    private static findStorageTarget(creep: Creep, resourceType: ResourceConstant): Structure | null {
      // 寻找可以存储指定类型资源的建筑
      const storage = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType === STRUCTURE_CONTAINER ||
                  structure.structureType === STRUCTURE_STORAGE ||
                  structure.structureType === STRUCTURE_TERMINAL) &&
                 structure.store.getFreeCapacity(resourceType) > 0;
        }
      });

      if (storage.length > 0) {
        return creep.pos.findClosestByPath(storage);
      }

      return null;
    }
  }
