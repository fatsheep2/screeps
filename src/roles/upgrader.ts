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

      // 在目标位置，设置为工作状态（和静态矿工一致，不再改变）
      creep.memory.working = true;

      // 执行升级工作
      this.performUpgradeWork(creep);
    }

    // 执行升级工作（到达目标位置后的工作逻辑）
    private static performUpgradeWork(creep: Creep): void {
      // 能量状态切换逻辑
      let shouldUpgrade = true;

      if (creep.store[RESOURCE_ENERGY] === 0) {
        shouldUpgrade = false;
      }

      if (creep.store.getFreeCapacity() === 0) {
        shouldUpgrade = true;
        creep.say('⚡ 升级');
      }

      if (shouldUpgrade && creep.store[RESOURCE_ENERGY] > 0) {
        // 有能量，升级控制器
        this.upgradeController(creep);
      } else {
        // 没有能量，请求配送
        this.getEnergy(creep);
      }
    }

    // 检查是否在目标位置
    private static isAtTargetPosition(creep: Creep, targetPos: RoomPosition): boolean {
      // 使用精确位置判断，和静态矿工保持一致
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

      // 如果任务已分配且在执行中，检查搬运工是否在身边
      if (existingTask.assignedTo && existingTask.status === 'IN_PROGRESS') {
        // assignedTo存储的是creep.id，用ID查找
        let assignedCarrier = Game.getObjectById(existingTask.assignedTo) as Creep;
        if (!assignedCarrier) {
          // 如果ID查找失败，尝试按名字查找（兼容旧数据）
          assignedCarrier = Game.creeps[existingTask.assignedTo];
        }

        if (!assignedCarrier) {
          // 搬运工已死亡，立即重置自己的状态
          (creep.memory as any).working = false;
          creep.say('💀 搬运工死亡');
          console.log(`[静态升级者] ${creep.name} 的搬运工已死亡，重置工作状态`);
          return;
        }

        if (assignedCarrier && creep.pos.isNearTo(assignedCarrier.pos)) {
          // 检查自己是否已经能够工作（在目标位置且能升级）
          if (this.canWork(creep)) {
            // 能工作了，设置working状态，任务系统会检测并完成任务
            creep.memory.working = true;
            creep.say('⚡ 开工');
            console.log(`[静态升级者] ${creep.name} 到达工作位置`);
            return;
          }
          
          // 还不能工作，继续配合搬运工
          // 标准Screeps pull机制：被拉拽者必须 move(搬运工)
          const moveResult = creep.move(assignedCarrier);
          if (moveResult === OK) {
            creep.say('🤝 配合');
          } else {
            creep.say(`🔄 配合(${moveResult})`);
          }
        } else if (assignedCarrier) {
          creep.say('⏳ 等待');
        }
      } else if (existingTask.assignedTo && existingTask.status === 'assigned') {
        creep.say('📋 已派工');
      }
    }

    // 分配升级位置（从memory的位置数组中选择未被预订的位置）
    private static assignUpgradePosition(creep: Creep): void {
      const controller = creep.room.controller;
      if (!controller) return;

      // 从memory获取预计算的升级者位置数组
      const allAvailablePositions = this.getUpgraderPositions(controller.pos);

      if (allAvailablePositions.length === 0) {
        console.log(`[升级者${creep.name}] 错误: 房间${creep.room.name}没有可用的升级者位置`);
        creep.say('❌ 无位置');
        return;
      }

      // 获取当前已被预订的位置
      const allUpgraders = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'upgrader' && c.memory.targetId
      });
      const occupiedPositions = allUpgraders.map(c => c.memory.targetId);

      // 按优先级顺序遍历位置数组，找到第一个未被预订的位置
      for (const pos of allAvailablePositions) {
        if (!occupiedPositions.includes(pos)) {
          const [x, y] = pos.split(',').map(Number);
          const targetPos = new RoomPosition(x, y, creep.room.name);

          // 最终检查位置是否真的可用（可能有临时障碍物）
          if (this.isPositionSuitableForUpgrader(targetPos, creep.room)) {
            creep.memory.targetId = pos;
            return;
          }
        }
      }

      // 所有预计算位置都被占用，输出警告
      console.log(`[升级者${creep.name}] 警告: 所有${allAvailablePositions.length}个升级位置都已被占用`);
      console.log(`[升级者${creep.name}] 已占用位置: ${occupiedPositions.join(', ')}`);
      creep.say('❌ 位置满');
    }

    // 获取可用升级者位置数量（公开方法，供生产管理器使用）
    public static getAvailableUpgraderPositionCount(room: Room): number {
      if (!room.controller || !room.controller.my) return 0;

      const positions = this.getUpgraderPositions(room.controller.pos);
      return positions.length;
    }

    // 强制重新计算升级者位置（当建筑布局变化时调用）
    public static recalculateUpgraderPositions(room: Room): void {
      if (!room.controller) return;

      // 清除memory中的缓存
      const roomMemory = Memory.rooms[room.name];
      if (roomMemory) {
        delete (roomMemory as any).upgraderPositions;
      }

      // 重新计算并缓存
      this.calculateAndCacheUpgraderPositions(room);
    }

    // 获取控制器周围的升级者位置（从memory缓存中获取或重新计算）
    private static getUpgraderPositions(controllerPos: RoomPosition): string[] {
      const room = Game.rooms[controllerPos.roomName];
      const roomMemory = Memory.rooms[room.name];

      // 检查memory中是否有缓存的位置数组
      if (roomMemory && roomMemory.upgraderPositions && roomMemory.upgraderPositions.length > 0) {
        return roomMemory.upgraderPositions;
      }

      // 没有缓存，重新计算并保存到memory
      return this.calculateAndCacheUpgraderPositions(room);
    }

    // 计算并缓存升级者位置到房间memory
    private static calculateAndCacheUpgraderPositions(room: Room): string[] {
      const controller = room.controller;
      if (!controller) return [];

      const positions: { pos: string; distanceToController: number; distanceToSpawn: number }[] = [];
      const controllerPos = controller.pos;

      // 找到房间的主城（Spawn）位置
      const spawns = room.find(FIND_MY_SPAWNS);
      const spawnPos = spawns.length > 0 ? spawns[0].pos : controllerPos;

      // 在7x7范围内寻找合适位置（以控制器为中心，-3到3是7格）
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          if (dx === 0 && dy === 0) continue; // 跳过控制器本身位置

          const x = controllerPos.x + dx;
          const y = controllerPos.y + dy;

          if (x < 1 || x > 48 || y < 1 || y > 48) continue; // 边界检查

          const terrain = Game.map.getRoomTerrain(controllerPos.roomName);
          if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
            const pos = new RoomPosition(x, y, controllerPos.roomName);

            // 检查是否有不可通行的建筑（排除道路）
            if (this.isPositionSuitableForUpgrader(pos, room)) {
              // 棋盘布局：以主城为模（奇偶性基准），与主城路网保持一致
              const isCheckerboard = (x + y) % 2 === (spawnPos.x + spawnPos.y) % 2;

              if (isCheckerboard) {
                const distanceToSpawn = spawnPos.getRangeTo(pos);
                const distanceToController = Math.max(Math.abs(dx), Math.abs(dy));

                positions.push({
                  pos: `${x},${y}`,
                  distanceToController: distanceToController,
                  distanceToSpawn: distanceToSpawn
                });
              }
            }
          }
        }
      }

      // 按优先级排序：距离控制器近的优先（1格距离优先），同等距离时按距离主城排序
      positions.sort((a, b) => {
        if (a.distanceToController !== b.distanceToController) {
          return a.distanceToController - b.distanceToController;
        }
        return a.distanceToSpawn - b.distanceToSpawn;
      });

      const positionArray = positions.map(p => p.pos);

      // 保存到房间memory
      if (!Memory.rooms[room.name]) {
        Memory.rooms[room.name] = {
          staticHarvesters: 0,
          upgraders: 0,
          builders: 0,
          carriers: 0,
          miningSpots: [],
          totalAvailableSpots: 0,
          tasks: {}
        };
      }

      (Memory.rooms[room.name] as any).upgraderPositions = positionArray;

      console.log(`[升级者] 房间${room.name}计算升级者位置: 共${positionArray.length}个可用位置已缓存到memory`);
      return positionArray;
    }

    // 检查是否能工作（在目标位置且能升级控制器）
    private static canWork(creep: Creep): boolean {
      if (!creep.memory.targetId) return false;
      
      const [x, y] = creep.memory.targetId.split(',').map(Number);
      const targetPos = new RoomPosition(x, y, creep.room.name);
      
      // 必须在目标位置
      if (!creep.pos.isEqualTo(targetPos)) return false;
      
      // 必须能升级控制器
      const controller = creep.room.controller;
      if (!controller || !controller.my) return false;
      
      // 必须在升级范围内
      if (creep.pos.getRangeTo(controller) > 3) return false;
      
      return true;
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
          return;
        }

        // 设置能量请求标记，搬运工会看到并创建配送任务
        (creep.memory as any).requestEnergy = true;

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
          creep.say('❌ 无能量');
        } else {
          creep.say('⏳ 等待配送');
        }
        return;
      }

      // 没有请求标记，说明是首次或自行获取模式
      // 静态升级者无法自行获取能量，必须请求配送
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        (creep.memory as any).requestEnergy = true;

      }
    }


  }
