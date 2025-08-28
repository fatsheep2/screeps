// 搬运工负载均衡管理器
export class CarrierLoadBalancer {

  // 每种任务类型的搬运工数量限制
  private static readonly TASK_TYPE_LIMITS: { [key: string]: number } = {
    'assistStaticHarvester': 2,    // 最多2个搬运工处理矿工搬运
    'assistStaticUpgrader': 2,     // 最多2个搬运工处理升级者搬运
    'collectEnergy': 3,            // 最多3个搬运工收集能量
    'deliverToCreep': 2,           // 最多2个搬运工配送给creep
    'deliverToSpawn': 1,           // 最多1个搬运工配送给spawn
    'supplyEnergy': 2              // 最多2个搬运工供给能量
  };

  // 检查任务类型是否已达到搬运工上限
  public static isTaskTypeFull(taskType: string, room: Room): boolean {
    const limit = this.TASK_TYPE_LIMITS[taskType];
    if (!limit) return false;

    const carriers = room.find(FIND_MY_CREEPS, {
      filter: (creep) => creep.memory.role === 'carrier'
    });

    // 统计当前处理该类型任务的搬运工数量
    let currentCount = 0;
    const roomMemory = Memory.rooms[room.name];

    for (const carrier of carriers) {
      if (carrier.memory.currentTaskId) {
        const task = roomMemory?.tasks?.[carrier.memory.currentTaskId];
        if (task && task.type === taskType) {
          currentCount++;
        }
      }

      // 检查批处理任务
      if (carrier.memory.currentTaskBatch) {
        for (const taskId of carrier.memory.currentTaskBatch) {
          const task = roomMemory?.tasks?.[taskId];
          if (task && task.type === taskType) {
            currentCount++;
            break; // 一个搬运工只计算一次
          }
        }
      }
    }

    const isFull = currentCount >= limit;
    if (isFull) {
      console.log(`[负载均衡] 任务类型 ${taskType} 已达上限 (${currentCount}/${limit})`);
    }

    return isFull;
  }

  // 获取搬运工的工作负载评分
  public static getCarrierWorkload(creep: Creep): number {
    let workload = 0;

    // 单任务负载
    if (creep.memory.currentTaskId) {
      workload += 1;
    }

    // 批处理任务负载
    if (creep.memory.currentTaskBatch) {
      workload += creep.memory.currentTaskBatch.length * 0.8; // 批处理效率更高
    }

    // 考虑搬运工当前状态
    if (creep.spawning) {
      workload += 2; // 正在生成，无法工作
    } else if (creep.fatigue > 0) {
      workload += 0.5; // 疲劳状态，效率降低
    }

    return workload;
  }

  // 智能选择最佳搬运工（增加距离和能量状态考虑）
  public static selectOptimalCarrier(
    availableCarriers: Creep[],
    task: any,
    allowBatching: boolean = true
  ): Creep | null {
    if (availableCarriers.length === 0) return null;

    // 检查任务类型是否已达上限
    if (this.isTaskTypeFull(task.type, Game.rooms[availableCarriers[0].room.name])) {
      return null;
    }

    // 获取任务位置
    const taskPos = this.getTaskPosition(task);

    // 按综合评分排序（负载 + 距离 + 能量状态）
    const scoredCarriers = availableCarriers.map(carrier => {
      const workload = this.getCarrierWorkload(carrier);
      const distance = taskPos ? carrier.pos.getRangeTo(taskPos) : 10;
      const energyFactor = this.getEnergyScoreForTask(carrier, task);

      // 综合评分：负载(30%) + 距离(40%) + 能量适配度(30%)
      const score = workload * 0.3 + distance * 0.4 + energyFactor * 0.3;

      return { carrier, score, workload, distance, energyFactor };
    }).sort((a, b) => a.score - b.score);

    // 如果允许批处理，优先考虑能批处理的搬运工
    if (allowBatching) {
      for (const entry of scoredCarriers) {
        if (this.canBatchWithCurrentTasks(entry.carrier, task)) {
          console.log(`[负载均衡] 选择批处理搬运工 ${entry.carrier.name} (评分:${entry.score.toFixed(1)}, 距离:${entry.distance})`);
          return entry.carrier;
        }
      }
    }

    // 选择空闲且评分最低的搬运工
    const idleCarriers = scoredCarriers.filter(entry =>
      !entry.carrier.memory.currentTaskId && !entry.carrier.memory.currentTaskBatch
    );

    const selectedEntry = idleCarriers.length > 0 ? idleCarriers[0] : scoredCarriers[0];

    if (selectedEntry) {
      console.log(`[负载均衡] 选择搬运工 ${selectedEntry.carrier.name} (评分:${selectedEntry.score.toFixed(1)}, 负载:${selectedEntry.workload}, 距离:${selectedEntry.distance}, 能量:${selectedEntry.energyFactor})`);
    }

    return selectedEntry?.carrier || null;
  }

  // 检查搬运工是否可以与当前任务批处理
  private static canBatchWithCurrentTasks(creep: Creep, newTask: any): boolean {
    // 如果搬运工已经有批处理任务，检查是否可以添加
    if (creep.memory.currentTaskBatch && creep.memory.currentTaskBatch.length < 3) {
      const roomMemory = Memory.rooms[creep.room.name];
      const currentTasks = creep.memory.currentTaskBatch.map(id => roomMemory?.tasks?.[id]).filter(Boolean);

      // 简单检查：同类型任务可以批处理
      for (const currentTask of currentTasks) {
        if (this.areTasksCompatible(currentTask, newTask)) {
          return true;
        }
      }
    }

    return false;
  }

  // 检查两个任务是否兼容批处理
  private static areTasksCompatible(task1: any, task2: any): boolean {
    // 收集任务可以与配送任务批处理
    const collectTypes = ['collectEnergy'];
    const deliveryTypes = ['deliverToCreep', 'deliverToSpawn', 'supplyEnergy'];

    const isTask1Collect = collectTypes.includes(task1.type);
    const isTask1Delivery = deliveryTypes.includes(task1.type);
    const isTask2Collect = collectTypes.includes(task2.type);
    const isTask2Delivery = deliveryTypes.includes(task2.type);

    // 收集+配送 或 配送+配送 可以批处理
    return (isTask1Collect && isTask2Delivery) ||
           (isTask1Delivery && isTask2Collect) ||
           (isTask1Delivery && isTask2Delivery);
  }

  // 动态调整任务类型限制
  public static adjustTaskLimits(room: Room): void {
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: (creep) => creep.memory.role === 'carrier'
    });

    const totalCarriers = carriers.length;

    if (totalCarriers < 3) {
      // 搬运工数量少时，减少限制
      this.TASK_TYPE_LIMITS['collectEnergy'] = 2;
      this.TASK_TYPE_LIMITS['deliverToCreep'] = 1;
    } else if (totalCarriers > 6) {
      // 搬运工数量多时，适当增加限制
      this.TASK_TYPE_LIMITS['collectEnergy'] = Math.min(4, Math.floor(totalCarriers * 0.5));
      this.TASK_TYPE_LIMITS['deliverToCreep'] = Math.min(3, Math.floor(totalCarriers * 0.3));
    }

    // 根据房间RCL调整
    const rcl = room.controller?.level || 1;
    if (rcl >= 4) {
      this.TASK_TYPE_LIMITS['assistStaticHarvester'] = Math.min(3, Math.floor(totalCarriers * 0.4));
      this.TASK_TYPE_LIMITS['assistStaticUpgrader'] = Math.min(3, Math.floor(totalCarriers * 0.3));
    }
  }

  // 获取任务分配统计
  public static getTaskAllocationStats(room: Room): { [taskType: string]: number } {
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: (creep) => creep.memory.role === 'carrier'
    });

    const stats: { [taskType: string]: number } = {};
    const roomMemory = Memory.rooms[room.name];

    for (const carrier of carriers) {
      if (carrier.memory.currentTaskId) {
        const task = roomMemory?.tasks?.[carrier.memory.currentTaskId];
        if (task) {
          stats[task.type] = (stats[task.type] || 0) + 1;
        }
      }

      if (carrier.memory.currentTaskBatch) {
        for (const taskId of carrier.memory.currentTaskBatch) {
          const task = roomMemory?.tasks?.[taskId];
          if (task) {
            stats[task.type] = (stats[task.type] || 0) + 1;
          }
        }
      }
    }

    return stats;
  }

  // 获取任务位置
  private static getTaskPosition(task: any): RoomPosition | null {
    try {
      if (task.position) {
        return new RoomPosition(task.position.x, task.position.y, task.roomName);
      }

      // 根据任务类型获取位置
      if (task.targetId) {
        const target = Game.getObjectById(task.targetId);
        if (target && 'pos' in target) {
          return (target as any).pos;
        }
      }

      if (task.spawnId) {
        const spawn = Game.getObjectById(task.spawnId) as StructureSpawn | null;
        if (spawn) {
          return spawn.pos;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // 获取搬运工在特定任务上的能量适配度评分
  private static getEnergyScoreForTask(carrier: Creep, task: any): number {
    const currentEnergy = carrier.store.getUsedCapacity(RESOURCE_ENERGY);
    const capacity = carrier.store.getCapacity(RESOURCE_ENERGY);

    // 供给类任务：有能量的搬运工更适合
    if (task.type === 'supplyEnergy' || task.type === 'deliverToSpawn' || task.type === 'deliverToCreep') {
      const requiredAmount = task.requiredAmount || 50;

      if (currentEnergy >= requiredAmount) {
        return 0; // 最佳 - 已有足够能量
      } else if (currentEnergy > 0) {
        return 2; // 次佳 - 有部分能量
      } else {
        return 5; // 较差 - 需要先取能量
      }
    }

    // 收集类任务：空载的搬运工更适合
    if (task.type === 'collectEnergy') {
      const freeCapacity = carrier.store.getFreeCapacity(RESOURCE_ENERGY);
      return (capacity - freeCapacity) / capacity * 3; // 越空越好
    }

    // 其他任务：中性评分
    return 2;
  }
}
