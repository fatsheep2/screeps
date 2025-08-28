// 任务批处理管理器 - 优化搬运工效率
export class TaskBatchingManager {

  // 为搬运工创建批处理任务
  public static createBatchedTask(creep: Creep, room: Room): any[] {
    const roomMemory = Memory.rooms[room.name];
    if (!roomMemory || !roomMemory.tasks) return [];

    const pendingTasks = Object.values(roomMemory.tasks).filter((task: any) =>
      task.status === 'pending' && !task.assignedTo
    );

    if (pendingTasks.length === 0) return [];

    // 获取creep当前位置
    const creepPos = creep.pos;
    const carrierCapacity = creep.store.getCapacity(RESOURCE_ENERGY);
    const currentEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY);

    // 分析可批处理的任务组合
    const batchableTask = this.findOptimalTaskBatch(
      pendingTasks as any[],
      creepPos,
      carrierCapacity,
      currentEnergy
    );

    return batchableTask;
  }

  // 寻找最优任务批次
  private static findOptimalTaskBatch(
    tasks: any[],
    startPos: RoomPosition,
    capacity: number,
    currentEnergy: number
  ): any[] {
    // 按任务类型分组
    const collectTasks = tasks.filter(t => t.type === 'collectEnergy');
    const deliveryTasks = tasks.filter(t =>
      t.type === 'deliverToCreep' ||
      t.type === 'deliverToSpawn' ||
      t.type === 'supplyEnergy'
    );

    // 策略1: 收集->配送 批处理
    const collectDeliveryBatch = this.createCollectDeliveryBatch(
      collectTasks, deliveryTasks, startPos, capacity, currentEnergy
    );

    if (collectDeliveryBatch.length > 1) {
      return collectDeliveryBatch;
    }

    // 策略2: 多重配送批处理（已有能量时）
    if (currentEnergy > 0) {
      const multiDeliveryBatch = this.createMultiDeliveryBatch(
        deliveryTasks, startPos, currentEnergy
      );

      if (multiDeliveryBatch.length > 1) {
        return multiDeliveryBatch;
      }
    }

    // 策略3: 多重收集批处理（空载时）
    if (currentEnergy === 0) {
      const multiCollectBatch = this.createMultiCollectBatch(
        collectTasks, startPos, capacity
      );

      if (multiCollectBatch.length > 1) {
        return multiCollectBatch;
      }
    }

    // 如果无法批处理，返回单个最高优先级任务
    const priorityOrder: { [key: string]: number } = {
      'urgent': 0, 'high': 1, 'normal': 2, 'low': 3
    };

    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return tasks.length > 0 ? [tasks[0]] : [];
  }

  // 创建 收集->配送 批处理
  private static createCollectDeliveryBatch(
    collectTasks: any[],
    deliveryTasks: any[],
    startPos: RoomPosition,
    capacity: number,
    currentEnergy: number
  ): any[] {
    if (collectTasks.length === 0 || deliveryTasks.length === 0) return [];

    // 寻找路径最优的收集+配送组合
    let bestBatch: any[] = [];
    let bestScore = Infinity;

    for (const collectTask of collectTasks.slice(0, 3)) { // 限制搜索范围
      const collectPos = this.getTaskPosition(collectTask);
      if (!collectPos) continue;

      const collectDistance = startPos.getRangeTo(collectPos);
      const collectAmount = Math.min(collectTask.amount || 100, capacity - currentEnergy);

      // 寻找顺路的配送任务
      for (const deliveryTask of deliveryTasks.slice(0, 5)) {
        const deliveryPos = this.getTaskPosition(deliveryTask);
        if (!deliveryPos) continue;

        const deliveryAmount = deliveryTask.requiredAmount || 50;

        // 检查能量是否足够
        if (currentEnergy + collectAmount < deliveryAmount) continue;

        const deliveryDistance = collectPos.getRangeTo(deliveryPos);
        const totalDistance = collectDistance + deliveryDistance;

        // 计算效率得分 (距离越短，处理任务越多，得分越好)
        const score = totalDistance / 2; // 2个任务

        if (score < bestScore) {
          bestScore = score;
          bestBatch = [collectTask, deliveryTask];
        }
      }
    }

    return bestBatch;
  }

  // 创建多重配送批处理
  private static createMultiDeliveryBatch(
    deliveryTasks: any[],
    startPos: RoomPosition,
    currentEnergy: number
  ): any[] {
    if (deliveryTasks.length < 2) return [];

    // 按距离排序配送任务
    const tasksWithDistance = deliveryTasks.map(task => ({
      task,
      pos: this.getTaskPosition(task),
      amount: task.requiredAmount || 50
    })).filter(item => item.pos);

    tasksWithDistance.sort((a, b) =>
      startPos.getRangeTo(a.pos!) - startPos.getRangeTo(b.pos!)
    );

    // 贪心算法：按路径顺序选择能完成的任务
    const batch: any[] = [];
    let remainingEnergy = currentEnergy;

    for (const item of tasksWithDistance) {
      if (remainingEnergy >= item.amount) {
        batch.push(item.task);
        remainingEnergy -= item.amount;

        // 最多批处理3个配送任务，避免路径过长
        if (batch.length >= 3) break;
      }
    }

    return batch.length > 1 ? batch : [];
  }

  // 创建多重收集批处理
  private static createMultiCollectBatch(
    collectTasks: any[],
    startPos: RoomPosition,
    capacity: number
  ): any[] {
    if (collectTasks.length < 2) return [];

    // 按距离和收集量排序
    const tasksWithDistance = collectTasks.map(task => ({
      task,
      pos: this.getTaskPosition(task),
      amount: Math.min(task.amount || 100, capacity)
    })).filter(item => item.pos);

    tasksWithDistance.sort((a, b) => {
      const distanceDiff = startPos.getRangeTo(a.pos!) - startPos.getRangeTo(b.pos!);
      if (Math.abs(distanceDiff) <= 5) {
        // 距离相近时，优先选择收集量大的
        return b.amount - a.amount;
      }
      return distanceDiff;
    });

    // 贪心算法：选择能装下的收集任务
    const batch: any[] = [];
    let remainingCapacity = capacity;

    for (const item of tasksWithDistance) {
      if (remainingCapacity >= item.amount) {
        batch.push(item.task);
        remainingCapacity -= item.amount;

        // 最多批处理3个收集任务
        if (batch.length >= 3) break;
      }
    }

    return batch.length > 1 ? batch : [];
  }

  // 获取任务位置
  private static getTaskPosition(task: any): RoomPosition | null {
    try {
      if (task.position) {
        return new RoomPosition(task.position.x, task.position.y, task.position.roomName);
      }
      if (task.targetPosition) {
        return new RoomPosition(task.targetPosition.x, task.targetPosition.y, task.targetPosition.roomName);
      }
      if (task.targetId) {
        const target = Game.getObjectById(task.targetId);
        return (target && 'pos' in target) ? (target as any).pos : null;
      }
      if (task.spawnId) {
        const spawn = Game.getObjectById(task.spawnId);
        return (spawn && 'pos' in spawn) ? (spawn as any).pos : null;
      }
      if (task.creepId) {
        const creep = Game.getObjectById(task.creepId);
        return (creep && 'pos' in creep) ? (creep as any).pos : null;
      }
    } catch (error) {
      console.log(`[任务批处理] 获取任务位置失败: ${error}`);
    }
    return null;
  }

  // 批量分配任务给搬运工
  public static assignBatchToCarrier(creep: Creep, taskBatch: any[], room: Room): void {
    const roomMemory = Memory.rooms[room.name];
    if (!roomMemory || !roomMemory.tasks) return;

    // 将批次任务ID存储到creep内存
    creep.memory.currentTaskBatch = taskBatch.map(task => task.id);
    creep.memory.currentTaskIndex = 0;

    // 更新每个任务的状态
    for (const task of taskBatch) {
      task.assignedTo = creep.id;
      task.assignedAt = Game.time;
      task.status = 'assigned';
      roomMemory.tasks[task.id] = task;
    }

    console.log(`[任务批处理] 为搬运工 ${creep.name} 分配了 ${taskBatch.length} 个批处理任务`);
  }
}
