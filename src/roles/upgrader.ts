export class RoleUpgrader {
    public static run(creep: Creep): void {
      // 如果没有分配工作位置，分配到控制器旁
      if (!creep.memory.targetId) {
        this.assignUpgradePosition(creep);
        return;
      }

      const [x, y] = creep.memory.targetId.split(',').map(Number);
      const targetPos = new RoomPosition(x, y, creep.room.name);

      // 检查是否需要搬运到位置
      if (!this.isAtTargetPosition(creep, targetPos)) {
        // 不在目标位置，需要搬运
        this.handleTransportation(creep, targetPos);
        return;
      }

      // 在目标位置，开始工作
      creep.memory.working = true;
      
      // 状态切换逻辑
      if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        creep.say('🔄 需要能量');
      }

      if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        creep.say('⚡ 升级');
      }

      if (creep.memory.working) {
        // 升级控制器
        this.upgradeController(creep);
      } else {
        // 请求能量配送
        this.getEnergy(creep);
      }
    }

    // 检查是否在目标位置
    private static isAtTargetPosition(creep: Creep, targetPos: RoomPosition): boolean {
      return creep.pos.isEqualTo(targetPos);
    }

    // 处理搬运需求（类似静态矿工）
    private static handleTransportation(creep: Creep, _targetPos: RoomPosition): void {
      // 检查房间任务队列中是否已有自己的搬运任务
      const roomMemory = Memory.rooms[creep.room.name];
      if (!roomMemory || !roomMemory.tasks) {
        creep.say('⏳ 等待搬运');
        return;
      }

      // 查找是否已有搬运任务
      const existingTask = Object.values(roomMemory.tasks).find((task: any) =>
        task.type === 'assistStaticUpgrader' &&
        task.upgraderId === creep.id
      );

      if (!existingTask) {
        // 没有任务，等待房间管理器创建
        creep.say('⏳ 等待搬运任务');
        return;
      }

      // 已有任务，显示状态并配合搬运工
      const statusText = existingTask.status === 'pending' ? '⏳ 等待分配' :
                        existingTask.status === 'assigned' ? '🚛 搬运中' :
                        existingTask.status === 'in_progress' ? '🚛 搬运中' : '❓ 未知状态';
      creep.say(statusText);

      // 如果任务已分配，检查搬运工是否在身边
      if (existingTask.assignedTo && (existingTask.status === 'assigned' || existingTask.status === 'in_progress')) {
        const assignedCarrier = Game.getObjectById(existingTask.assignedTo) as Creep;
        if (assignedCarrier && creep.pos.isNearTo(assignedCarrier.pos)) {
          // 搬运工在身边，升级者配合pull操作
          const moveResult = creep.move(assignedCarrier);
          if (moveResult === OK) {
            creep.say('🤝 配合搬运');
            console.log(`[静态升级者${creep.name}] 配合搬运工${assignedCarrier.name}的pull操作`);
          } else {
            console.log(`[静态升级者${creep.name}] 配合pull失败: ${moveResult}`);
          }
        }
      }
    }

    // 分配升级位置（棋盘布局，支持搬运工通行）
    private static assignUpgradePosition(creep: Creep): void {
      const controller = creep.room.controller;
      if (!controller) return;

      // 获取房间中所有静态升级者
      const staticUpgraders = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'upgrader' && c.memory.targetId
      });

      // 在控制器7x7范围内按棋盘模式寻找升级者位置
      const controllerPos = controller.pos;
      const upgraderPositions = this.getUpgraderPositions(controllerPos);

      // 检查哪些位置已被占用
      const occupiedPositions = staticUpgraders.map(c => c.memory.targetId);

      // 按优先级分配位置（距离控制器越近优先级越高）
      for (const pos of upgraderPositions) {
        if (!occupiedPositions.includes(pos)) {
          const [x, y] = pos.split(',').map(Number);
          const targetPos = new RoomPosition(x, y, creep.room.name);
          
          // 检查位置是否可用
          if (this.isPositionSuitableForUpgrader(targetPos, creep.room)) {
            creep.memory.targetId = pos;
            console.log(`静态升级者 ${creep.name} 分配到升级位置 ${pos} (距离控制器${controllerPos.getRangeTo(targetPos)}格)`);
            return;
          }
        }
      }

      console.log(`静态升级者 ${creep.name} 没有找到可用的升级位置`);
    }

    // 获取控制器周围的棋盘式升级者位置（按距离排序）
    private static getUpgraderPositions(controllerPos: RoomPosition): string[] {
      const positions: { pos: string; distance: number }[] = [];

      // 在7x7范围内寻找合适位置
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          if (dx === 0 && dy === 0) continue; // 跳过控制器本身位置
          
          const x = controllerPos.x + dx;
          const y = controllerPos.y + dy;
          
          if (x < 1 || x > 48 || y < 1 || y > 48) continue; // 边界检查
          
          const distance = Math.abs(dx) + Math.abs(dy);
          
          // 棋盘模式：曼哈顿距离为偶数的位置用于放置升级者（类似Extension位置）
          // 奇数位置留给道路，供搬运工通行
          if (distance % 2 === 0 && distance <= 3) { // 最远3格，确保能升级控制器
            const terrain = Game.map.getRoomTerrain(controllerPos.roomName);
            if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
              positions.push({
                pos: `${x},${y}`,
                distance: distance
              });
            }
          }
        }
      }

      // 按距离排序，距离近的优先
      positions.sort((a, b) => a.distance - b.distance);
      
      console.log(`[升级者位置] 控制器周围找到 ${positions.length} 个可用升级位置`);
      return positions.map(p => p.pos);
    }

    // 检查位置是否适合放置升级者
    private static isPositionSuitableForUpgrader(pos: RoomPosition, room: Room): boolean {
      // 检查地形
      const terrain = Game.map.getRoomTerrain(room.name);
      if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
        return false;
      }

      // 检查是否已有建筑（允许道路，不允许其他建筑）
      const structures = pos.lookFor(LOOK_STRUCTURES);
      for (const structure of structures) {
        if (structure.structureType !== STRUCTURE_ROAD) {
          return false; // 有非道路建筑，不能放置
        }
      }

      // 检查是否有其他creep
      const creeps = pos.lookFor(LOOK_CREEPS);
      if (creeps.length > 0) {
        return false;
      }

      // 检查是否有建筑工地（除了道路）
      const constructionSites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
      for (const site of constructionSites) {
        if (site.structureType !== STRUCTURE_ROAD) {
          return false;
        }
      }

      return true;
    }

    private static upgradeController(creep: Creep): void {
      if (creep.room.controller) {
        const result = creep.upgradeController(creep.room.controller);

        if (result === ERR_NOT_IN_RANGE) {
          // 静态升级者没有MOVE部件，不能移动，应该被搬运到正确位置
          creep.say('❌ 位置错误');
          console.log(`[静态升级者${creep.name}] 距离控制器太远，需要重新搬运`);
          delete creep.memory.targetId; // 清除错误的目标位置，重新分配
        } else if (result === OK) {
          // 升级成功时显示特效
          creep.say('⚡');
        }
      }
    }

    private static getEnergy(creep: Creep): void {
      // 检查是否需要请求能量配送
      if (!(creep.memory as any).requestEnergy && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        // 检查是否即将死亡，如果是则不请求能量
        if (creep.ticksToLive && creep.ticksToLive < 50) {
          // 即将死亡，尝试自行获取能量
          this.getEnergyFromSources(creep);
          return;
        }

        // 设置能量请求标记，搬运工会看到并创建配送任务
        (creep.memory as any).requestEnergy = true;
        creep.say('🙏 请求能量');
        console.log(`[升级者${creep.name}] 请求能量配送`);
        return;
      }

      // 如果已经请求了但还没有收到配送，等待一段时间
      if ((creep.memory as any).requestEnergy) {
        // 等待配送，如果等待时间过长则转为自行获取
        if (!(creep.memory as any).lastRequestTime) {
          (creep.memory as any).lastRequestTime = Game.time;
        }

        if (Game.time - (creep.memory as any).lastRequestTime > 30) {
          // 等待超时，转为自行获取能量
          delete (creep.memory as any).requestEnergy;
          delete (creep.memory as any).lastRequestTime;
          this.getEnergyFromSources(creep);
        } else {
          creep.say('⏳ 等待配送');
        }
        return;
      }

      // 没有请求标记，说明是首次或自行获取模式
      this.getEnergyFromSources(creep);
    }

    private static getEnergyFromSources(creep: Creep): void {
      // 检查房间中是否有搬运工和静态矿工
      const carriers = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'carrier'
      });

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

      // 1. 优先从 Storage 获取能量
      const storage = creep.room.storage;
      if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        target = storage;
        creep.say('🏪 从仓库获取');
      }

      // 2. 其次从 Container 获取能量
      if (!target) {
        const containers = creep.room.find(FIND_STRUCTURES, {
          filter: (structure) => {
            return structure.structureType === STRUCTURE_CONTAINER &&
                   structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
          }
        });

        if (containers.length > 0) {
          target = creep.pos.findClosestByPath(containers);
          creep.say('📦 从容器获取');
        }
      }

      // 3. 最后从 Spawn 和 Extension 获取能量（主城资源）
      if (!target) {
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
          creep.say('🏰 从主城获取');
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
