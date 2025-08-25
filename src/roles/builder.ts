export class RoleBuilder {
    public static run(creep: Creep): void {
      // 状态切换逻辑
      if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        creep.say('🔄 获取能量');
        delete creep.memory.targetId; // 清除目标ID
      }

      if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        creep.say('🚧 建造');
      }

      if (creep.memory.working) {
        // 建造模式
        this.buildStructures(creep);
      } else {
        // 获取能量模式
        this.getEnergy(creep);
      }
    }

    private static buildStructures(creep: Creep): void {
      let target: ConstructionSite | Structure | null = null;

      // 1. 优先建造建筑工地
      const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (constructionSites.length > 0) {
        // 建造优先级：Spawn > Extension > Container > Road > Wall
        const priorities = [
          STRUCTURE_SPAWN,
          STRUCTURE_EXTENSION,
          STRUCTURE_CONTAINER,
          STRUCTURE_TOWER,
          STRUCTURE_ROAD,
          STRUCTURE_WALL,
          STRUCTURE_RAMPART
        ];

        for (const structureType of priorities) {
          const sites = constructionSites.filter(site => site.structureType === structureType);
          if (sites.length > 0) {
            target = creep.pos.findClosestByPath(sites);
            break;
          }
        }

        // 如果没有优先级建筑，就建造最近的
        if (!target) {
          target = creep.pos.findClosestByPath(constructionSites);
        }
      }

      // 2. 如果没有建筑工地，就维修受损建筑
      if (!target) {
        target = this.findRepairTarget(creep);
      }

      // 3. 如果没有维修任务，就帮助升级控制器
      if (!target && creep.room.controller) {
        const result = creep.upgradeController(creep.room.controller);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, {
            visualizePathStyle: { stroke: '#ffffff' }
          });
        }
        return;
      }

      // 执行建造或维修
      if (target) {
        let result: number;

        if (target instanceof ConstructionSite) {
          result = creep.build(target);
          if (result === OK) {
            creep.say('🔨');
          }
        } else {
          result = creep.repair(target);
          if (result === OK) {
            creep.say('🔧');
          }
        }

        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ffffff' }
          });
        }
      }
    }

    private static findRepairTarget(creep: Creep): Structure | null {
      // 寻找需要维修的建筑
      const damagedStructures = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          // 只维修血量低于80%的建筑
          return structure.hits < structure.hitsMax * 0.8 &&
                 // 不维修敌方建筑
                 (structure.structureType !== STRUCTURE_WALL &&
                  structure.structureType !== STRUCTURE_RAMPART) ||
                 // 墙和城墙只在血量很低时维修
                 ((structure.structureType === STRUCTURE_WALL ||
                   structure.structureType === STRUCTURE_RAMPART) &&
                  structure.hits < 10000);
        }
      });

      if (damagedStructures.length > 0) {
        // 按优先级排序：重要建筑优先
        const priorities = [
          STRUCTURE_SPAWN,
          STRUCTURE_EXTENSION,
          STRUCTURE_TOWER,
          STRUCTURE_CONTAINER,
          STRUCTURE_ROAD
        ];

        for (const structureType of priorities) {
          const structures = damagedStructures.filter(s => s.structureType === structureType);
          if (structures.length > 0) {
            return creep.pos.findClosestByPath(structures);
          }
        }

        return creep.pos.findClosestByPath(damagedStructures);
      }

      return null;
    }

    private static getEnergy(creep: Creep): void {
      // 检查房间中是否有搬运工（Carrier）
      const carriers = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'carrier'
      });

      if (carriers.length === 0) {
        // 没有搬运工，等待基础工种建立
        creep.say('⏳ 等待搬运工');
        return;
      }

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
          console.log(`🏗️ Builder ${creep.name} 从主城获取能量: ${target.structureType}`);
        }
      }

      // 2. 从容器获取
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
          console.log(`📦 Builder ${creep.name} 从容器获取能量`);
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
