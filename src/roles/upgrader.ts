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
      // 检查房间中是否有搬运工（Carrier）
      const carriers = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'carrier'
      });

      // 检查房间中是否有静态矿工（StaticHarvester）
      const staticHarvesters = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'staticHarvester'
      });

      if (carriers.length === 0 || staticHarvesters.length === 0) {
        // 没有搬运工或静态矿工，等待基础工种建立
        if (carriers.length === 0) {
          creep.say('⏳ 等待搬运工');
        } else {
          creep.say('⏳ 等待静态矿工');
        }
        return;
      }

      // 获取能量的优先级顺序
      let target: Structure | null = null;

      // 1. 优先从 Spawn 和 Extension 获取能量（主城资源）
      const energyStructures = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType === STRUCTURE_SPAWN ||
                  structure.structureType === STRUCTURE_EXTENSION) &&
                 structure.store.getUsedCapacity(RESOURCE_ENERGY) > 100; // 保留一些给生产
        }
      });

      if (energyStructures.length > 0) {
        // 选择最近的 Spawn 或 Extension
        target = creep.pos.findClosestByPath(energyStructures);
        if (target) {
          console.log(`⚡ Upgrader ${creep.name} 从主城获取能量: ${target.structureType}`);
        }
      }

      // 2. 从容器或存储器获取
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
          console.log(`📦 Upgrader ${creep.name} 从容器获取能量`);
        }
      }

      // 执行获取能量
      if (target) {
        const result = creep.withdraw(target, RESOURCE_ENERGY);

        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ffaa00' }
          });
        } else if (result === OK) {
          creep.say('⚡');
        }
      } else {
        // 没有资源可获取，等待主城有资源
        creep.say('等待资源');
      }
    }
  }
