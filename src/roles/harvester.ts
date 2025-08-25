export class RoleHarvester {
    public static run(creep: Creep): void {
      // 如果 Creep 正在工作但能量已满，切换到存储模式
      if (creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = false;
        creep.say('🏠 存储');
      }

      // 如果 Creep 不在工作且能量为空，切换到采集模式
      if (!creep.memory.working && creep.store.getUsedCapacity() === 0) {
        creep.memory.working = true;
        creep.say('⛏️ 采集');
      }

      if (creep.memory.working) {
        // 采集模式：寻找最近的能量源
        this.harvestEnergy(creep);
      } else {
        // 存储模式：将能量存储到合适的地方
        this.storeEnergy(creep);
      }
    }

    private static harvestEnergy(creep: Creep): void {
      // 寻找房间内的能量源
      const sources = creep.room.find(FIND_SOURCES);

      if (sources.length > 0) {
        // 为每个采集者分配固定的资源点，避免拥堵
        let targetSource: Source;

        if (creep.memory.sourceIndex !== undefined && sources[creep.memory.sourceIndex]) {
          targetSource = sources[creep.memory.sourceIndex];
        } else {
          // 分配资源点：根据 Creep 名字分配
          const sourceIndex = creep.name.charCodeAt(creep.name.length - 1) % sources.length;
          creep.memory.sourceIndex = sourceIndex;
          targetSource = sources[sourceIndex];
        }

        // 移动并采集
        if (creep.harvest(targetSource) === ERR_NOT_IN_RANGE) {
          creep.moveTo(targetSource, {
            visualizePathStyle: { stroke: '#ffaa00' }
          });
        }
      }
    }

    private static storeEnergy(creep: Creep): void {
      // 寻找存储目标，按优先级排序
      let target: Structure | null = null;

      // 1. 优先给 Spawn 补充能量
      const spawns = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return structure.structureType === STRUCTURE_SPAWN &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (spawns.length > 0) {
        target = spawns[0];
      }

      // 2. 其次给 Extension 补充能量
      if (!target) {
        const extensions = creep.room.find(FIND_STRUCTURES, {
          filter: (structure) => {
            return structure.structureType === STRUCTURE_EXTENSION &&
                   structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
          }
        });

        if (extensions.length > 0) {
          target = creep.pos.findClosestByPath(extensions);
        }
      }

      // 3. 最后存储到容器或存储器
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

      // 执行存储
      if (target) {
        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ffffff' }
          });
        }
      } else {
        // 如果没有找到存储目标，就在控制器旁边等待
        if (creep.room.controller) {
          creep.moveTo(creep.room.controller);
        }
      }
    }
  }
