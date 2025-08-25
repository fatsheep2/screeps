export class RoleUpgrader {
    public static run(creep: Creep): void {
      // 状态切换逻辑
      if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        creep.say('🔄 获取能量');
      }

      if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        creep.say('⚡ 升级');
      }

      if (creep.memory.working) {
        // 升级控制器
        this.upgradeController(creep);
      } else {
        // 获取能量
        this.getEnergy(creep);
      }
    }

    private static upgradeController(creep: Creep): void {
      if (creep.room.controller) {
        const result = creep.upgradeController(creep.room.controller);

        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, {
            visualizePathStyle: { stroke: '#ffffff' }
          });
        } else if (result === OK) {
          // 升级成功时显示特效
          creep.say('⚡');
        }
      }
    }

    private static getEnergy(creep: Creep): void {
      // 获取能量的优先级顺序
      let target: Structure | Resource | Source | null = null;

      // 1. 优先从容器或存储器获取
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

      // 2. 从地面拾取掉落的能量
      if (!target) {
        const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
          filter: (resource) => resource.resourceType === RESOURCE_ENERGY
        });

        if (droppedEnergy.length > 0) {
          target = creep.pos.findClosestByPath(droppedEnergy);
        }
      }

      // 3. 如果以上都没有，从 Spawn/Extension 获取（但要确保不影响生产）
      if (!target) {
        const spawns = creep.room.find(FIND_STRUCTURES, {
          filter: (structure) => {
            return structure.structureType === STRUCTURE_SPAWN &&
                   structure.store.getUsedCapacity(RESOURCE_ENERGY) > 300; // 保留一些给生产
          }
        });

        if (spawns.length > 0) {
          target = spawns[0];
        }
      }

      // 4. 最后选择：自己采集
      if (!target) {
        const sources = creep.room.find(FIND_SOURCES);
        if (sources.length > 0) {
          target = creep.pos.findClosestByPath(sources);
        }
      }

      // 执行获取能量
      if (target) {
        let result: number;

        if (target instanceof Resource) {
          result = creep.pickup(target);
        } else if (target instanceof Source) {
          result = creep.harvest(target);
        } else {
          result = creep.withdraw(target, RESOURCE_ENERGY);
        }

        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ffaa00' }
          });
        }
      }
    }
  }
