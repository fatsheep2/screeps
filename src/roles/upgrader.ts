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

      // 使用实际的升级者数量而不是房间内存中的滞后值
      // 获取房间中所有静态升级者（包括已分配位置和未分配位置的）
      const allUpgraders = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'upgrader'
      });

      const staticUpgraders = allUpgraders.filter(c => c.memory.targetId);

      console.log(`[升级者位置] 当前有${allUpgraders.length}个升级者，其中${staticUpgraders.length}个已分配位置`);

      // 在控制器7x7范围内寻找升级者位置（按距离主城排序）
      const controllerPos = controller.pos;
      const allAvailablePositions = this.getUpgraderPositions(controllerPos);

      // 根据实际升级者数量确定需要的位置数量
      const neededPositions = allUpgraders.length;
      const upgraderPositions = allAvailablePositions.slice(0, neededPositions);

      console.log(`[升级者位置] 为${neededPositions}个升级者选择前${upgraderPositions.length}个最优位置`);

      // 检查哪些位置已被占用
      const occupiedPositions = staticUpgraders.map(c => c.memory.targetId);

      // 按优先级分配位置（距离主城最近的优先）
      for (const pos of upgraderPositions) {
        if (!occupiedPositions.includes(pos)) {
          const [x, y] = pos.split(',').map(Number);
          const targetPos = new RoomPosition(x, y, creep.room.name);

          // 检查位置是否可用
          if (this.isPositionSuitableForUpgrader(targetPos, creep.room)) {
            creep.memory.targetId = pos;

            // 计算距离信息
            const distanceToController = controllerPos.getRangeTo(targetPos);
            const spawns = creep.room.find(FIND_MY_SPAWNS);
            const distanceToSpawn = spawns.length > 0 ? spawns[0].pos.getRangeTo(targetPos) : 0;

            console.log(`静态升级者 ${creep.name} 分配到升级位置 ${pos} (距控制器${distanceToController}格, 距主城${distanceToSpawn}格)`);
            return;
          }
        }
      }

      console.log(`静态升级者 ${creep.name} 没有找到可用的升级位置 (已有${staticUpgraders.length}个已分配，总共${allUpgraders.length}个升级者)`);
    }

    // 获取可用升级者位置数量（公开方法，供生产管理器使用）
    public static getAvailableUpgraderPositionCount(room: Room): number {
      if (!room.controller || !room.controller.my) return 0;

      const positions = this.getUpgraderPositions(room.controller.pos);
      return positions.length;
    }

    // 获取控制器周围的升级者位置（7x7范围，按距离主城排序）
    private static getUpgraderPositions(controllerPos: RoomPosition): string[] {
      const positions: { pos: string; distanceToController: number; distanceToSpawn: number }[] = [];
      const room = Game.rooms[controllerPos.roomName];

      // 找到房间的主城（Spawn）位置
      const spawns = room.find(FIND_MY_SPAWNS);
      const spawnPos = spawns.length > 0 ? spawns[0].pos : controllerPos;

                                    // 在7x7范围内寻找合适位置（以控制器为中心）
      let totalScanned = 0;
      let validTerrain = 0;
      let checkerboardPositions = 0;

      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          if (dx === 0 && dy === 0) continue; // 跳过控制器本身位置
          totalScanned++;

          const x = controllerPos.x + dx;
          const y = controllerPos.y + dy;

          if (x < 1 || x > 48 || y < 1 || y > 48) continue; // 边界检查

          const terrain = Game.map.getRoomTerrain(controllerPos.roomName);
          if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
            validTerrain++;
            const pos = new RoomPosition(x, y, controllerPos.roomName);

            // 棋盘布局：以主城坐标为基准，使用相同的奇偶性模式
            // 这样便于后期铺路规划
            const isCheckerboard = (x + y) % 2 === (spawnPos.x + spawnPos.y) % 2;

            console.log(`[升级者位置] 检查位置(${x},${y}): 棋盘=${isCheckerboard}, 位置模=${(x + y) % 2}, 主城模=${(spawnPos.x + spawnPos.y) % 2}`);

            // 选择棋盘位置，为搬运工留出通道
            if (isCheckerboard) {
              checkerboardPositions++;
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

      console.log(`[升级者位置] 调试信息: 扫描${totalScanned}个位置, 有效地形${validTerrain}个, 棋盘位置${checkerboardPositions}个`);

      // 按优先级排序：只考虑距离主城，便于能量配送
      positions.sort((a, b) => {
        return a.distanceToSpawn - b.distanceToSpawn;
      });

      // 输出详细的位置信息
      const positionDetails = positions.slice(0, 10).map(p =>
        `(${p.pos}) 距控制器${p.distanceToController}格,距主城${p.distanceToSpawn}格`
      ).join(', ');

      console.log(`[升级者位置] 控制器周围找到 ${positions.length} 个可用升级位置，按距离主城排序:`);
      console.log(`[升级者位置] 前10个最优位置: ${positionDetails}`);
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
          return;
        }

        // 设置能量请求标记，搬运工会看到并创建配送任务
        (creep.memory as any).requestEnergy = true;
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
          console.log(`[升级者${creep.name}] 等待配送超时，无法自行获取能量（无MOVE部件）`);
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
        console.log(`[升级者${creep.name}] 需要能量，发起配送请求`);
      }
    }


  }
