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
      let target: Structure | Resource | Source | null = null;

      // 1. 从容器获取
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

      // 2. 拾取掉落的资源
      if (!target) {
        const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
          filter: (resource) => resource.resourceType === RESOURCE_ENERGY
        });

        if (droppedEnergy.length > 0) {
          target = creep.pos.findClosestByPath(droppedEnergy);
        }
      }

      // 3. 从能量源采集
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
