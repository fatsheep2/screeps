// 重构后的任务系统 - 真正的蜂群思维
// 原则：管理者派发任务 -> 分配给合适的creep -> creep无脑执行
// 消除所有特殊情况，简化到本质

// 任务类型 - 扩展更多需求类型
export enum TaskType {
  // 供应类任务（最高优先级）
  SUPPLY_SPAWN = 'supply_spawn',           // 给spawn供能
  SUPPLY_EXTENSION = 'supply_extension',   // 给extension供能
  
  // 协助类任务（高优先级）
  ASSIST_HARVESTER = 'assist_harvester',   // 协助静态矿工
  ASSIST_UPGRADER = 'assist_upgrader',     // 协助静态升级者
  
  // 配送类任务（中等优先级）
  SUPPLY_BUILDER = 'supply_builder',       // 给建筑者供能
  SUPPLY_UPGRADER = 'supply_upgrader',     // 给升级者供能
  
  // 收集类任务（中等优先级）
  COLLECT_ENERGY = 'collect_energy',       // 收集掉落能量
  WITHDRAW_ENERGY = 'withdraw_energy',     // 从container/storage取能量
  
  // 存储类任务（低优先级）
  STORE_ENERGY = 'store_energy',           // 存储能量到container/storage
  
  // 维护类任务（低优先级）
  CLEAR_TOMBSTONE = 'clear_tombstone',     // 清理墓碑
  CLEAR_RUIN = 'clear_ruin'               // 清理废墟
}

// 任务优先级 - 只有3级，简单粗暴
export enum TaskPriority {
  CRITICAL = 0,    // 关键：矿工支持、spawn供能
  HIGH = 1,        // 高：extension供能、升级者支持
  NORMAL = 2       // 正常：其他任务
}

// 任务接口 - 消除所有不必要的字段
export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  roomName: string;
  createdAt: number;
  assignedTo?: string;

  // 任务参数 - 统一结构，消除特殊情况
  targetId?: string;           // 目标ID（creep或structure）
  targetPos?: RoomPosition;    // 目标位置
  amount?: number;             // 数量
  resourceType?: ResourceConstant;
}

// 任务系统管理器 - 单一职责，只做三件事
export class TaskSystem {

  // 主循环：扫描需求，创建任务，分配执行
  public static update(room: Room): void {
    // 紧急简化：大幅减少任务创建频率
    if (Game.time % 5 === 0) {
      this.scanAndCreateTasks(room);
    }
    
    this.assignTasksToCreeps(room);
    
    // 清理放在最后，减少干扰
    if (Game.time % 10 === 0) {
      this.cleanupCompletedTasks(room);
    }
  }

  // 扫描房间需求，创建任务 - 扩展更多需求类型
  private static scanAndCreateTasks(room: Room): void {
    // 1. 静态矿工支持 - 最高优先级
    this.scanHarvesterNeeds(room);

    // 2. Spawn能量供应 - 紧急
    this.scanSpawnNeeds(room);

    // 3. Extension能量供应
    this.scanExtensionNeeds(room);

    // 4. 能量流转需求 - 创建智能任务链
    this.scanEnergyTransferNeeds(room);

    // 5. 收集维护需求 - 掉落能量、墓碑、废墟
    this.scanMaintenanceNeeds(room);

    // 6. 其他配送需求
    this.scanOtherNeeds(room);
  }

  // 扫描矿工需求 - 简化逻辑
  private static scanHarvesterNeeds(room: Room): void {
    const staticMiners = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'staticHarvester' &&
                   (c.memory as any).targetId &&
                   c.getActiveBodyparts(MOVE) === 0 &&
                   !(c.memory as any).working
    });

    for (const miner of staticMiners) {
      if (!this.hasActiveTask(room, TaskType.ASSIST_HARVESTER, miner.id)) {
        const [x, y] = (miner.memory as any).targetId!.split(',').map(Number);
        this.createTask(room, {
          type: TaskType.ASSIST_HARVESTER,
          priority: TaskPriority.CRITICAL,
          targetId: miner.id,
          targetPos: new RoomPosition(x, y, room.name)
        });
      }
    }
  }

  // 扫描Spawn需求
  private static scanSpawnNeeds(room: Room): void {
    const spawns = room.find(FIND_MY_SPAWNS, {
      filter: s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    for (const spawn of spawns) {
      if (!this.hasActiveTask(room, TaskType.SUPPLY_SPAWN, spawn.id)) {
        this.createTask(room, {
          type: TaskType.SUPPLY_SPAWN,
          priority: TaskPriority.CRITICAL,
          targetId: spawn.id,
          targetPos: spawn.pos,
          amount: spawn.store.getFreeCapacity(RESOURCE_ENERGY),
          resourceType: RESOURCE_ENERGY
        });
      }
    }
  }

  // 扫描Extension需求
  private static scanExtensionNeeds(room: Room): void {
    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION &&
                   s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }) as StructureExtension[];

    for (const extension of extensions) {
      if (!this.hasActiveTask(room, TaskType.SUPPLY_EXTENSION, extension.id)) {
        this.createTask(room, {
          type: TaskType.SUPPLY_EXTENSION,
          priority: TaskPriority.HIGH,
          targetId: extension.id,
          targetPos: extension.pos,
          amount: extension.store.getFreeCapacity(RESOURCE_ENERGY),
          resourceType: RESOURCE_ENERGY
        });
      }
    }
  }

  // 扫描其他需求
  private static scanOtherNeeds(room: Room): void {
    // 静态升级者支持 - 修复条件：只要是静态upgrader且不在工作位置就需要搬运
    const staticUpgraders = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'upgrader' &&
                   (c.memory as any).targetId &&
                   c.getActiveBodyparts(MOVE) === 0 &&
                   !(c.memory as any).working  // 还没开始工作就需要搬运
    });

    for (const upgrader of staticUpgraders) {
      if (!this.findTask(room, TaskType.ASSIST_UPGRADER, upgrader.id)) {
        const [x, y] = (upgrader.memory as any).targetId!.split(',').map(Number);
        this.createTask(room, {
          type: TaskType.ASSIST_UPGRADER,
          priority: TaskPriority.HIGH,
          targetId: upgrader.id,
          targetPos: new RoomPosition(x, y, room.name)
        });
      }
    }

    // 建筑者供能
    const builders = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'builder' &&
                   c.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                   (c.memory as any).requestEnergy === true
    });

    for (const builder of builders) {
      if (!this.findTask(room, TaskType.SUPPLY_BUILDER, builder.id)) {
        this.createTask(room, {
          type: TaskType.SUPPLY_BUILDER,
          priority: TaskPriority.NORMAL,
          targetId: builder.id,
          targetPos: builder.pos
        });
      }
    }
  }

  // 扫描能量流转需求 - 智能任务链
  private static scanEnergyTransferNeeds(room: Room): void {
    // 获取当前有能量需求但搬运工没有能量的情况
    const carriersWithoutEnergy = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'carrier' &&
                   c.store.getUsedCapacity(RESOURCE_ENERGY) === 0 &&
                   !(c.memory as any).currentTaskId
    });

    if (carriersWithoutEnergy.length === 0) return;

    // 查找可用的能量源（优先级：container > storage > tombstone）
    const energySources = room.find(FIND_STRUCTURES, {
      filter: s => (s.structureType === STRUCTURE_CONTAINER ||
                   s.structureType === STRUCTURE_STORAGE) &&
                   s.store.getUsedCapacity(RESOURCE_ENERGY) > 100
    });

    // 为每个没能量的搬运工创建取能量任务
    for (const carrier of carriersWithoutEnergy.slice(0, energySources.length)) {
      const source = carrier.pos.findClosestByPath(energySources);
      if (source && !this.findTask(room, TaskType.WITHDRAW_ENERGY, source.id)) {
        this.createTask(room, {
          type: TaskType.WITHDRAW_ENERGY,
          priority: TaskPriority.HIGH,
          targetId: source.id,
          targetPos: source.pos
        });
      }
    }
  }

  // 扫描维护需求 - 掉落能量、墓碑、废墟
  private static scanMaintenanceNeeds(room: Room): void {
    // 1. 扫描大量掉落能量（>200）
    const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 200
    });

    for (const resource of droppedEnergy) {
      if (!this.findTask(room, TaskType.COLLECT_ENERGY, resource.id)) {
        this.createTask(room, {
          type: TaskType.COLLECT_ENERGY,
          priority: TaskPriority.NORMAL,
          targetId: resource.id,
          targetPos: resource.pos,
          amount: resource.amount
        });
      }
    }

    // 2. 扫描墓碑
    const tombstones = room.find(FIND_TOMBSTONES, {
      filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });

    for (const tombstone of tombstones) {
      if (!this.findTask(room, TaskType.CLEAR_TOMBSTONE, tombstone.id)) {
        this.createTask(room, {
          type: TaskType.CLEAR_TOMBSTONE,
          priority: TaskPriority.NORMAL,
          targetId: tombstone.id,
          targetPos: tombstone.pos
        });
      }
    }

    // 3. 扫描废墟
    const ruins = room.find(FIND_RUINS, {
      filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });

    for (const ruin of ruins) {
      if (!this.findTask(room, TaskType.CLEAR_RUIN, ruin.id)) {
        this.createTask(room, {
          type: TaskType.CLEAR_RUIN,
          priority: TaskPriority.NORMAL,
          targetId: ruin.id,
          targetPos: ruin.pos
        });
      }
    }

    // 4. 扫描存储需求（背包满了的搬运工需要存储）
    const carriersNeedingStorage = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'carrier' &&
                   c.store.getFreeCapacity(RESOURCE_ENERGY) === 0 &&
                   c.store.getUsedCapacity(RESOURCE_ENERGY) > 0 &&
                   !(c.memory as any).currentTaskId
    });

    const storageTargets = room.find(FIND_STRUCTURES, {
      filter: s => (s.structureType === STRUCTURE_CONTAINER ||
                   s.structureType === STRUCTURE_STORAGE) &&
                   s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    for (const carrier of carriersNeedingStorage) {
      const target = carrier.pos.findClosestByPath(storageTargets);
      if (target && !this.findTask(room, TaskType.STORE_ENERGY, target.id)) {
        this.createTask(room, {
          type: TaskType.STORE_ENERGY,
          priority: TaskPriority.NORMAL,
          targetId: target.id,
          targetPos: target.pos
        });
      }
    }
  }

  // 分配任务给creep - 简化逻辑，消除抢占
  private static assignTasksToCreeps(room: Room): void {
    const roomMemory = this.getRoomMemory(room);

    // 获取所有搬运工
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'carrier'
    });

    if (carriers.length === 0) {
      console.log(`[任务分配] 房间 ${room.name} 没有搬运工`);
      return;
    }

    // 获取待分配任务，按优先级排序
    const pendingTasks = Object.values((roomMemory as any).tasks || {})
      .filter((task: any) => !task.assignedTo)
      .sort((a: any, b: any) => a.priority - b.priority) as Task[];
    
    console.log(`[任务分配] 房间 ${room.name}: ${carriers.length}个搬运工, ${pendingTasks.length}个待分配任务`);

    // 获取空闲搬运工（包括任务已完成/无效的carrier）
    const availableCarriers = carriers.filter(c => {
      const taskId = (c.memory as any).currentTaskId;
      if (!taskId) return true; // 没有任务ID的是空闲的
      
      // 检查任务是否存在
      const task = (roomMemory as any).tasks?.[taskId];
      if (!task) {
        // 任务不存在，清理任务ID，标记为空闲
        console.log(`[任务分配] ${c.name} 的任务 ${taskId} 不存在，清理并标记为空闲`);
        delete (c.memory as any).currentTaskId;
        return true;
      }
      
      return false; // 有有效任务的不是空闲的
    });

    // 按优先级分配任务
    for (const task of pendingTasks) {
      if (availableCarriers.length === 0) break;

      const carrier = this.findBestCarrierForTask(availableCarriers, task);
      if (carrier) {
        this.assignTaskToCreep(room, task, carrier);
        const index = availableCarriers.indexOf(carrier);
        availableCarriers.splice(index, 1);
      }
    }
  }

  // 为任务找到最合适的搬运工 - 简单距离算法
  private static findBestCarrierForTask(carriers: Creep[], task: Task): Creep | null {
    if (carriers.length === 0) return null;
    if (!task.targetPos) return carriers[0];

    let bestCarrier = carriers[0];
    let bestDistance = bestCarrier.pos.getRangeTo(task.targetPos);

    for (let i = 1; i < carriers.length; i++) {
      const carrier = carriers[i];
      const distance = carrier.pos.getRangeTo(task.targetPos);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCarrier = carrier;
      }
    }

    return bestCarrier;
  }

  // 分配任务给creep - 简化逻辑
  private static assignTaskToCreep(room: Room, task: Task, creep: Creep): void {
    const roomMemory = this.getRoomMemory(room);

    // 更新任务
    task.assignedTo = creep.id;
    (roomMemory as any).tasks![task.id] = task;

    // 更新creep内存
    (creep.memory as any).currentTaskId = task.id;

    console.log(`[任务系统] 分配任务 ${task.type} 给 ${creep.name}`);
  }

  // 创建任务 - 简化逻辑
  private static createTask(room: Room, taskData: Partial<Task>): string {
    const roomMemory = this.getRoomMemory(room);
    const taskId = `${taskData.type}_${Game.time}_${Math.random().toString(36).substr(2, 9)}`;

    const task: Task = {
      id: taskId,
      type: taskData.type!,
      priority: taskData.priority!,
      roomName: room.name,
      createdAt: Game.time,
      ...taskData
    };

    (roomMemory as any).tasks![taskId] = task;
    return taskId;
  }

  // 查找现有任务 - 简化逻辑
  private static findTask(room: Room, type: TaskType, targetId: string): Task | null {
    const roomMemory = this.getRoomMemory(room);
    const tasks = (roomMemory as any).tasks || {};

    return (Object.values(tasks) as Task[])
      .find(task => task.type === type && task.targetId === targetId) || null;
  }
  
  // 增强版：检查是否有活跃任务（目标仍然存在且需要）
  private static hasActiveTask(room: Room, type: TaskType, targetId: string): boolean {
    const existingTask = this.findTask(room, type, targetId);
    if (!existingTask) return false;
    
    // 验证目标是否仍然存在且需要服务
    const target = Game.getObjectById(targetId);
    if (!target) return false;
    
    // 针对不同任务类型进行特定检查
    if (type === TaskType.ASSIST_HARVESTER) {
      const creep = target as Creep;
      return creep && !(creep.memory as any).working;
    }
    
    if ([TaskType.SUPPLY_SPAWN, TaskType.SUPPLY_EXTENSION].includes(type)) {
      const structure = target as StructureSpawn | StructureExtension;
      return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    }
    
    return true; // 其他类型暂时简单返回true
  }

  // 清理完成任务 - 增强逻辑
  private static cleanupCompletedTasks(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasksToDelete: string[] = [];

    for (const [taskId, task] of Object.entries((roomMemory as any).tasks || {})) {
      const typedTask = task as Task;
      let shouldDelete = false;

      // 1. 删除分配给已死亡creep的任务
      if (typedTask.assignedTo && !Game.creeps[typedTask.assignedTo]) {
        shouldDelete = true;
        console.log(`[任务清理] 删除死亡creep ${typedTask.assignedTo} 的任务 ${taskId}`);
      }

      // 2. 删除过期任务（超过1000tick的任务）
      if (Game.time - typedTask.createdAt > 1000) {
        shouldDelete = true;
        console.log(`[任务清理] 删除过期任务 ${taskId} (${Game.time - typedTask.createdAt}tick前创建)`);
      }

      // 3. 删除目标不存在的任务
      if (typedTask.targetId && !Game.getObjectById(typedTask.targetId)) {
        // 所有任务都检查目标是否存在
        shouldDelete = true;
        console.log(`[任务清理] 删除目标不存在的任务 ${taskId} (目标: ${typedTask.targetId})`);
      }
      
      // 4. 特殊检查：协助类任务的目标creep状态
      if ([TaskType.ASSIST_HARVESTER, TaskType.ASSIST_UPGRADER].includes(typedTask.type) && typedTask.targetId) {
        const targetCreep = Game.getObjectById(typedTask.targetId);
        if (targetCreep) {
          // 检查目标creep是否还需要协助
          const creep = targetCreep as Creep;
          
          // 如果目标creep已经在工作位置（working=true），任务完成
          if ((creep.memory as any).working) {
            shouldDelete = true;
            console.log(`[任务清理] 目标creep ${creep.name} 已在工作位置，删除协助任务 ${taskId}`);
          }
          
          // 如果目标creep即将死亡（剩余生命<50），取消任务
          if (creep.ticksToLive && creep.ticksToLive < 50) {
            shouldDelete = true;
            console.log(`[任务清理] 目标creep ${creep.name} 即将死亡，删除协助任务 ${taskId}`);
          }
        }
      }
      
      // 5. 供应类任务的特殊检查
      if ([TaskType.SUPPLY_SPAWN, TaskType.SUPPLY_EXTENSION].includes(typedTask.type) && typedTask.targetId) {
        const target = Game.getObjectById(typedTask.targetId);
        if (target) {
          // 检查目标结构是否还需要能量
          const structure = target as StructureSpawn | StructureExtension;
          if (structure.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            shouldDelete = true;
            console.log(`[任务清理] 目标结构 ${structure.id} 已满，删除供应任务 ${taskId}`);
          }
        }
      }
      
      // 6. 配送类任务的特殊检查
      if ([TaskType.SUPPLY_BUILDER, TaskType.SUPPLY_UPGRADER].includes(typedTask.type) && typedTask.targetId) {
        const targetCreep = Game.getObjectById(typedTask.targetId);
        if (targetCreep) {
          const creep = targetCreep as Creep;
          // 检查目标creep是否还需要能量
          if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            shouldDelete = true;
            console.log(`[任务清理] 目标creep ${creep.name} 能量已满，删除配送任务 ${taskId}`);
          }
          
          // 检查是否还有请求标记
          if (typedTask.type === TaskType.SUPPLY_BUILDER && !(creep.memory as any).requestEnergy) {
            shouldDelete = true;
            console.log(`[任务清理] 建筑者 ${creep.name} 不再请求能量，删除配送任务 ${taskId}`);
          }
        }
      }

      if (shouldDelete) {
        tasksToDelete.push(taskId);
      }
    }

    // 删除无效任务
    for (const taskId of tasksToDelete) {
      delete (roomMemory as any).tasks![taskId];
    }

    if (tasksToDelete.length > 0) {
      console.log(`[任务清理] 房间 ${room.name} 清理了 ${tasksToDelete.length} 个无效任务`);
    }
  }

  // 获取房间内存 - 简化结构
  private static getRoomMemory(room: Room): any {
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

    if (!(Memory.rooms[room.name] as any).tasks) {
      (Memory.rooms[room.name] as any).tasks = {};
    }

    return Memory.rooms[room.name];
  }

  // 公开方法：获取creep的当前任务
  public static getCreepTask(creep: Creep): Task | null {
    if (!(creep.memory as any).currentTaskId) return null;

    const roomMemory = this.getRoomMemory(creep.room);
    const task = (roomMemory as any).tasks?.[(creep.memory as any).currentTaskId];
    
    // 如果任务不存在，清理creep的任务ID
    if (!task) {
      console.log(`[任务系统] ${creep.name} 的任务 ${(creep.memory as any).currentTaskId} 不存在，清理任务ID`);
      delete (creep.memory as any).currentTaskId;
      return null;
    }
    
    return task;
  }

  // 公开方法：完成任务
  public static completeTask(creep: Creep): void {
    if (!(creep.memory as any).currentTaskId) return;

    const roomMemory = this.getRoomMemory(creep.room);
    const task = (roomMemory as any).tasks?.[(creep.memory as any).currentTaskId];

    if (task) {
      delete (roomMemory as any).tasks![task.id];
    }

    delete (creep.memory as any).currentTaskId;
    console.log(`[任务系统] ${creep.name} 完成任务`);
  }

  // 调试方法：显示房间任务状态
  public static debugRoomTasks(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = (roomMemory as any).tasks || {};

    console.log(`[任务系统] 房间 ${room.name} 任务状态:`);
    console.log(`  总任务数: ${Object.keys(tasks).length}`);

    for (const task of Object.values(tasks) as Task[]) {
      const status = task.assignedTo ? '已分配' : '待分配';
      const carrier = task.assignedTo ? Game.creeps[task.assignedTo]?.name : '无';
      console.log(`  ${task.type} (优先级:${task.priority}) - ${status} - ${carrier}`);
    }
  }
}