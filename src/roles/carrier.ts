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

      // 检查是否已经完成交换（运输兵在矿工原位置，矿工在目标位置）
      if (target.pos.isEqualTo(targetPos) && !creep.pos.isEqualTo(targetPos)) {
        // 交换完成，清除帮助状态
        creep.say('✅ 交换完成');
        console.log(`运输兵 ${creep.name} 与矿工 ${target.name} 交换位置完成`);
        delete creep.memory.helpingStaticHarvester;
        return;
      }

      // 检查运输兵是否已经到达目标位置
      if (creep.pos.isEqualTo(targetPos)) {
        // 已经到达目标位置，现在需要让矿工也过来
        creep.say('📍 等待矿工');
        console.log(`运输兵 ${creep.name} 到达目标位置 (${targetPos.x},${targetPos.y})，等待矿工 ${target.name} 过来`);

        // 直接和矿工交换位置
        creep.say('🔄 交换位置');
        console.log(`运输兵 ${creep.name} 准备与矿工 ${target.name} 交换位置`);

        // 先 pull 矿工
        const pullResult = creep.pull(target);
        if (pullResult == OK) {
          console.log(`运输兵 ${creep.name} 开始 pull 矿工 ${target.name}`);

          // 让矿工移动到运输兵位置（目标位置）
          const moveResult = target.move(creep);
          if (moveResult == OK) {
            // 矿工成功移动到目标位置，现在运输兵移动到矿工的原位置
            const harvesterOriginalPos = target.pos;
            creep.moveTo(harvesterOriginalPos, {
              visualizePathStyle: { stroke: '#ffaa00' },
              reusePath: 3
            });
            creep.say('🔄 交换中');
            // 等待下一轮完成真正的交换
          } else {
            // 矿工移动失败，继续协助
            creep.say('⚠️ 移动失败');
            console.log(`矿工 ${target.name} 移动失败，结果: ${moveResult}`);
          }
        } else {
          // pull 失败，先移动到矿工身边
          creep.say('❌ Pull失败');
          creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 3
          });
        }
        return;
      }

            // 还没到达目标位置，需要同时考虑与矿工的距离
      const distanceToTarget = creep.pos.getRangeTo(targetPos);
      const distanceToHarvester = creep.pos.getRangeTo(target);

      // 如果矿工距离太远，先回到矿工身边
      if (distanceToHarvester > 1) {
        creep.say(`📢 回到矿工身边 距离:${distanceToHarvester}格`);
        console.log(`运输兵 ${creep.name} 距离矿工太远 (${distanceToHarvester}格)，先回到矿工身边`);
        creep.moveTo(target, {
          visualizePathStyle: { stroke: '#00ff00' },
          reusePath: 3
        });
        return;
      }

      // 矿工在附近，可以一起移动
      creep.say(`🚶 前往目标 (${targetPos.x},${targetPos.y}) 距离:${distanceToTarget}格`);
      console.log(`运输兵 ${creep.name} 协助矿工 ${target.name} 前往目标位置 (${targetPos.x},${targetPos.y})，当前距离: ${distanceToTarget}格`);

      // 一直 pull 矿工，直到到达目标位置
      const pullResult = creep.pull(target);
      if (pullResult == OK) {
        // 让矿工跟随
        target.move(creep);

        // 向目标位置移动一步
        creep.moveTo(targetPos, {
          visualizePathStyle: { stroke: '#00ff00' },
          reusePath: 5
        });
        creep.say('🔄 前进');
      } else {
        // pull 失败，先移动到矿工身边
        creep.moveTo(target, {
          visualizePathStyle: { stroke: '#00ff00' },
          reusePath: 3
        });
      }
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

      // 1. 优先运输到 Extension（扩展建筑）
      const extensions = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return structure.structureType === STRUCTURE_EXTENSION &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (extensions.length > 0) {
        target = creep.pos.findClosestByPath(extensions);
        creep.say('🏗️ 填充扩展');
      }

      // 2. 然后运输到 Spawn（主城）
      if (!target) {
        const spawns = creep.room.find(FIND_STRUCTURES, {
          filter: (structure) => {
            return structure.structureType === STRUCTURE_SPAWN &&
                   structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
          }
        });

        if (spawns.length > 0) {
          target = creep.pos.findClosestByPath(spawns);
          creep.say('🏰 填充主城');
        }
      }

      // 3. 运输到容器
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
          creep.say('📦 填充容器');
        }
      }

      // 4. 运输到建筑工地
      if (!target) {
        const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
        if (constructionSites.length > 0) {
          target = creep.pos.findClosestByPath(constructionSites);
          creep.say('🔨 建造');
        }
      }

      // 5. 最后运输到控制器
      if (!target && creep.room.controller) {
        target = creep.room.controller;
        creep.say('⚡ 升级');
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
