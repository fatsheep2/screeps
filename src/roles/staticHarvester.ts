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

    const [x, y] = creep.memory.targetId.split(',').map(Number);
    const targetPos = new RoomPosition(x, y, creep.room.name);

    // 检查是否需要搬运
    if (!this.isAtTargetPosition(creep, targetPos)) {
      // 不在目标位置，需要搬运
      this.handleTransportation(creep, targetPos);
      return;
    }

    // 在目标位置，可以工作
    creep.memory.working = true;
    this.startMining(creep);
  }

  // 检查是否在目标位置
  private static isAtTargetPosition(creep: Creep, targetPos: RoomPosition): boolean {
    return creep.pos.isEqualTo(targetPos);
  }

  // 处理搬运需求
  private static handleTransportation(creep: Creep, _targetPos: RoomPosition): void {
    // 检查房间任务队列中是否已有自己的搬运任务
    const roomMemory = Memory.rooms[creep.room.name];
    if (!roomMemory || !roomMemory.tasks) {
      // 没有任务系统，等待房间管理器创建任务
      creep.say('⏳ 等待搬运');
      return;
    }

    // 查找是否已有搬运任务（包括所有状态）
    const existingTask = Object.values(roomMemory.tasks).find((task: any) =>
      task.type === 'assistStaticHarvester' &&
      task.harvesterId === creep.id
    );

    if (!existingTask) {
      // 没有任务，等待房间管理器创建
      creep.say('⏳ 等待搬运任务');
      return;
    }

    // 已有任务，显示状态
    const statusText = existingTask.status === 'pending' ? '⏳ 等待分配' :
                      existingTask.status === 'assigned' ? '🚛 搬运中' :
                      existingTask.status === 'in_progress' ? '🚛 搬运中' : '❓ 未知状态';
    creep.say(statusText);

    // 如果任务已分配，检查搬运工是否在身边
    if (existingTask.assignedTo && (existingTask.status === 'assigned' || existingTask.status === 'in_progress')) {
      const assignedCarrier = Game.creeps[existingTask.assignedTo];
      if (assignedCarrier && creep.pos.isNearTo(assignedCarrier.pos)) {
        // 搬运工在身边，跟着走
        const moveResult = creep.move(assignedCarrier);
        if (moveResult === OK) {
          console.log(`[静态矿工${creep.name}] 跟随搬运工移动`);
        }
      }
    }
  }

  // 分配工作地点
  private static assignWorkLocation(creep: Creep): void {
    const roomMemory = Memory.rooms[creep.room.name];
    if (!roomMemory || !roomMemory.miningSpots || roomMemory.miningSpots.length === 0) {
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
      }
    } catch (error) {
      console.log(`验证静态矿工 ${creep.name} 的 targetId 时发生错误: ${error}`);
      delete creep.memory.targetId;
    }
  }

  // 开始挖矿
  private static startMining(creep: Creep): void {
    // 在目标位置开始挖矿
    const sources = creep.room.find(FIND_SOURCES_ACTIVE);
    if (sources.length > 0) {
      const nearestSource = creep.pos.findClosestByRange(sources);
      if (nearestSource) {
        const harvestResult = creep.harvest(nearestSource);
        if (harvestResult === OK) {
        } else if (harvestResult === ERR_NOT_IN_RANGE) {
          // 虽然到达目标位置，但可能还需要微调
          creep.moveTo(nearestSource, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    }
  }
}
