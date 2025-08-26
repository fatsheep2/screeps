export class RoleStaticHarvester {
  public static run(creep: Creep): void {
    // 如果没有分配工作地点，从 memory 中选择一个
    if (!creep.memory.targetId) {
      this.assignWorkLocation(creep);
      return;
    }

    // 检查自己的 targetId 是否仍然有效（每10个tick检查一次）
    if (Game.time % 10 === 0) {
      this.validateTargetId(creep);
      // 验证后再次检查 targetId 是否仍然存在
      if (!creep.memory.targetId) {
        this.assignWorkLocation(creep);
        return;
      }
    }

    // 再次确保 targetId 存在（双重保险）
    if (!creep.memory.targetId) {
      this.assignWorkLocation(creep);
      return;
    }

    const [x, y] = creep.memory.targetId.split(',').map(Number);
    const targetPos = new RoomPosition(x, y, creep.room.name);

    // 直接执行 travel 方法，根据返回值判断 working 状态
    const canWork = this.travel(creep, targetPos);

    if (canWork) {
      // 可以工作，执行挖矿
      creep.memory.working = true;
      creep.say('⛏️ 工作中');
      this.startMining(creep);
    } else {
      // 不能工作，等待运输
      creep.memory.working = false;
      // 删除等待运输的提示，避免资源挖空时也显示
    }
  }

  // 分配工作地点
  private static assignWorkLocation(creep: Creep): void {
    const roomMemory = Memory.rooms[creep.room.name];
    if (!roomMemory || !roomMemory.miningSpots || roomMemory.miningSpots.length === 0) {
      creep.say('⏳ 等待采矿点');
      return;
    }

    // 获取房间中所有静态矿工
    const staticHarvesters = creep.room.find(FIND_MY_CREEPS, {
      filter: (c) => c.memory.role === 'staticHarvester' && c.memory.targetId
    });

    // 检查哪些采矿点已被占用
    const occupiedSpots = staticHarvesters.map(c => c.memory.targetId);

    // 寻找第一个未被占用的采矿点
    for (const spot of roomMemory.miningSpots) {
      // 安全检查：确保 spot 是有效的字符串格式
      if (!spot || typeof spot !== 'string' || !spot.includes(',')) {
        console.log(`警告：发现无效的采矿点格式: ${spot}`);
        continue;
      }

      if (!occupiedSpots.includes(spot)) {
        // 额外检查：确保这个位置实际上没有被其他矿工占据
        try {
          const [spotX, spotY] = spot.split(',').map(Number);

          // 验证坐标的有效性
          if (isNaN(spotX) || isNaN(spotY) || spotX < 0 || spotX >= 50 || spotY < 0 || spotY >= 50) {
            console.log(`警告：采矿点坐标无效: ${spot}`);
            continue;
          }

          const spotPos = new RoomPosition(spotX, spotY, creep.room.name);

          // 检查这个位置是否有其他矿工
          const creepsAtSpot = spotPos.lookFor(LOOK_CREEPS);
          const hasOtherHarvester = creepsAtSpot.some(c =>
            c.memory.role === 'staticHarvester' && c.id !== creep.id
          );

          if (!hasOtherHarvester) {
            creep.memory.targetId = spot;
            creep.say(`📍 分配到 ${spot}`);
            console.log(`静态矿工 ${creep.name} 分配到采矿点 ${spot}`);
            return;
          } else {
            console.log(`采矿点 ${spot} 已被其他矿工实际占据，跳过`);
          }
        } catch (error) {
          console.log(`处理采矿点 ${spot} 时发生错误: ${error}`);
          continue;
        }
      }
    }

    // 如果所有采矿点都被占用，等待
    creep.say('⏳ 所有采矿点已满');
  }

  // 验证 targetId 是否仍然有效
  private static validateTargetId(creep: Creep): void {
    if (!creep.memory.targetId) return;

    // 安全检查：确保 targetId 是有效的字符串格式
    if (typeof creep.memory.targetId !== 'string' || !creep.memory.targetId.includes(',')) {
      console.log(`警告：静态矿工 ${creep.name} 的 targetId 格式无效: ${creep.memory.targetId}`);
      delete creep.memory.targetId;
      return;
    }

    try {
      const [x, y] = creep.memory.targetId.split(',').map(Number);

      // 验证坐标的有效性
      if (isNaN(x) || isNaN(y) || x < 0 || x >= 50 || y < 0 || y >= 50) {
        console.log(`警告：静态矿工 ${creep.name} 的 targetId 坐标无效: ${creep.memory.targetId}`);
        delete creep.memory.targetId;
        return;
      }

      const targetPos = new RoomPosition(x, y, creep.room.name);

      // 检查这个位置是否有其他矿工
      const creepsAtSpot = targetPos.lookFor(LOOK_CREEPS);
      const hasOtherHarvester = creepsAtSpot.some(c =>
        c.memory.role === 'staticHarvester' && c.id !== creep.id
      );

      if (hasOtherHarvester) {
        // 发现冲突，清除 targetId 并重新分配
        console.log(`静态矿工 ${creep.name} 发现采矿点冲突，重新分配`);
        delete creep.memory.targetId;
        creep.say('⚠️ 重新分配');
      }
    } catch (error) {
      console.log(`验证静态矿工 ${creep.name} 的 targetId 时发生错误: ${error}`);
      delete creep.memory.targetId;
    }
  }

  // travel 方法：检查是否可以到达采矿点并工作
  private static travel(creep: Creep, targetPos: RoomPosition): boolean {
    // 检查是否在采矿点±1范围内
    const distanceToTarget = creep.pos.getRangeTo(targetPos);

    if (distanceToTarget <= 1) {
      // 在采矿点±1范围内，尝试挖矿看是否真的可以工作
      const sources = creep.room.find(FIND_SOURCES_ACTIVE);
      if (sources.length > 0) {
        const nearestSource = creep.pos.findClosestByRange(sources);
        if (nearestSource) {
          const harvestResult = creep.harvest(nearestSource);
          if (harvestResult === OK) {
            // 挖矿成功，可以工作
            return true;
          } else if (harvestResult === ERR_NOT_IN_RANGE) {
            // 虽然距离≤1格，但仍然无法挖矿，需要移动到资源点
            creep.moveTo(nearestSource, { visualizePathStyle: { stroke: '#ffaa00' } });
            return false;
          } else {
            // 其他挖矿错误
            console.log(`静态矿工 ${creep.name} 挖矿失败，错误码: ${harvestResult}`);
            return false;
          }
        }
      }
      return false;
    } else {
      // 不在采矿点±1范围内，尝试移动到采矿点
      const result = creep.moveTo(targetPos, {
        visualizePathStyle: { stroke: '#ffaa00' },
        reusePath: 5
      });

      if (result === OK || result === ERR_TIRED) {
        // 移动成功或疲劳，继续移动
        return false;
      } else {
        // 移动失败，可能是路径问题
        console.log(`静态矿工 ${creep.name} 移动失败，错误码: ${result}`);
        return false;
      }
    }
  }

  // 开始挖矿
  private static startMining(creep: Creep): void {
    // 挖矿逻辑已经在 travel 方法中处理，这里只需要显示工作状态
    creep.say('💎');
  }
}
