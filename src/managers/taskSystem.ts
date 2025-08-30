// 极简任务系统 - 蜂群思维
// 管理者派发任务，工人无脑执行

// 任务类型 - 兼容历史版本
export enum TaskType {
  ASSIST_HARVESTER = 'assistStaticHarvester',     // 协助静态矿工 - 兼容历史
  ASSIST_UPGRADER = 'assistStaticUpgrader',       // 协助静态升级者 - 兼容历史
  SUPPLY_SPAWN = 'supply_spawn',                  // 给spawn供能
  SUPPLY_EXTENSION = 'supply_extension',          // 给extension供能
  WITHDRAW_ENERGY = 'withdraw_energy',            // 从container取能量
  COLLECT_DROPPED = 'collect_dropped'             // 收集掉落能量
}

// 任务优先级
export enum TaskPriority {
  CRITICAL = 0,    // 关键：矿工支持、spawn供能
  HIGH = 1,        // 高：extension供能
  NORMAL = 2       // 正常：其他
}

// 简化任务接口
export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  targetId: string;
  targetPos?: RoomPosition;
  assignedTo?: string;
  status?: string;  // 兼容现有角色代码
  createdAt: number;
}

// 蜂群任务系统 - 极简设计
export class TaskSystem {
  
  // 主循环：只做三件事
  public static update(room: Room): void {
    console.log(`[任务系统] 更新房间 ${room.name}`);
    this.createTasks(room);
    this.assignTasks(room);
    this.cleanupTasks(room);
  }

  // 1. 创建任务 - 只创建真正需要的任务
  private static createTasks(room: Room): void {
    
    // 矿工支持任务 - 最高优先级
    const idleMiners = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'staticHarvester' && 
                   !(c.memory as any).working &&
                   c.getActiveBodyparts(MOVE) === 0
    });
    
    console.log(`[任务系统] 找到 ${idleMiners.length} 个需要搬运的矿工`);
    
    for (const miner of idleMiners) {
      // 检查矿工是否有目标位置
      if (!(miner.memory as any).targetId) {
        console.log(`[任务系统] 矿工 ${miner.name} 没有目标位置，跳过`);
        continue;
      }
      
      if (!this.hasTask(room, TaskType.ASSIST_HARVESTER, miner.id)) {
        const [x, y] = (miner.memory as any).targetId!.split(',').map(Number);
        const targetPos = new RoomPosition(x, y, room.name);
        
        this.createHarvesterTask(room, {
          type: TaskType.ASSIST_HARVESTER,
          priority: TaskPriority.CRITICAL,
          harvesterId: miner.id,
          targetPosition: { x: targetPos.x, y: targetPos.y },
          harvesterPosition: { x: miner.pos.x, y: miner.pos.y }
        });
      }
    }
    
    // 升级者支持任务 - 最高优先级
    const idleUpgraders = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'upgrader' && 
                   !(c.memory as any).working &&
                   c.getActiveBodyparts(MOVE) === 0
    });
    
    console.log(`[任务系统] 找到 ${idleUpgraders.length} 个需要搬运的升级者`);
    
    for (const upgrader of idleUpgraders) {
      // 检查升级者是否有目标位置
      if (!(upgrader.memory as any).targetId) {
        console.log(`[任务系统] 升级者 ${upgrader.name} 没有目标位置，跳过`);
        continue;
      }
      
      if (!this.hasTask(room, TaskType.ASSIST_UPGRADER, upgrader.id)) {
        const [x, y] = (upgrader.memory as any).targetId!.split(',').map(Number);
        const targetPos = new RoomPosition(x, y, room.name);
        
        this.createUpgraderTask(room, {
          type: TaskType.ASSIST_UPGRADER,
          priority: TaskPriority.CRITICAL,
          upgraderId: upgrader.id,
          targetPosition: { x: targetPos.x, y: targetPos.y },
          upgraderPosition: { x: upgrader.pos.x, y: upgrader.pos.y }
        });
      }
    }
    
    // spawn供能任务
    const emptySpawns = room.find(FIND_MY_SPAWNS, {
      filter: s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    
    for (const spawn of emptySpawns) {
      if (!this.hasTask(room, TaskType.SUPPLY_SPAWN, spawn.id)) {
        this.createTask(room, {
          type: TaskType.SUPPLY_SPAWN,
          priority: TaskPriority.CRITICAL,
          targetId: spawn.id,
          targetPos: spawn.pos
        });
      }
    }
    
    // extension供能任务 - 只有当有足够能量的搬运工时
    if (this.hasEnergyCarriers(room)) {
      const emptyExtensions = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION &&
                     (s as StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });
      
      for (const ext of emptyExtensions.slice(0, 5)) { // 限制数量
        if (!this.hasTask(room, TaskType.SUPPLY_EXTENSION, ext.id)) {
          this.createTask(room, {
            type: TaskType.SUPPLY_EXTENSION,
            priority: TaskPriority.HIGH,
            targetId: ext.id,
            targetPos: ext.pos
          });
        }
      }
    }
    
    // 取能量任务 - 为空手搬运工创建
    const emptyCarriers = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'carrier' &&
                   c.store.getUsedCapacity(RESOURCE_ENERGY) === 0 &&
                   !(c.memory as any).currentTaskId
    });
    
    if (emptyCarriers.length > 0) {
      const energySources = room.find(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                     (s as any).store.getUsedCapacity(RESOURCE_ENERGY) > 100
      });
      
      for (let i = 0; i < Math.min(emptyCarriers.length, energySources.length); i++) {
        const source = energySources[i];
        if (!this.hasTask(room, TaskType.WITHDRAW_ENERGY, source.id)) {
          this.createTask(room, {
            type: TaskType.WITHDRAW_ENERGY,
            priority: TaskPriority.CRITICAL,
            targetId: source.id,
            targetPos: source.pos
          });
        }
      }
    }
    
    // 收集掉落能量
    const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    });
    
    for (const resource of droppedEnergy.slice(0, 2)) {
      if (!this.hasTask(room, TaskType.COLLECT_DROPPED, resource.id)) {
        this.createTask(room, {
          type: TaskType.COLLECT_DROPPED,
          priority: TaskPriority.NORMAL,
          targetId: resource.id,
          targetPos: resource.pos
        });
      }
    }
  }

  // 2. 分配任务 - 简单粗暴
  private static assignTasks(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = (roomMemory as any).tasks || {};
    
    // 获取空闲搬运工
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'carrier'
    });
    
    const freeCarriers = carriers.filter(c => !(c.memory as any).currentTaskId);
    
    console.log(`[任务系统] 房间 ${room.name}: ${carriers.length} 个搬运工, ${freeCarriers.length} 个空闲, ${Object.keys(tasks).length} 个任务`);
    
    // 获取未分配任务，按优先级排序 - 兼容历史版本字符串优先级
    const pendingTasks = Object.values(tasks)
      .filter((task: any) => !task.assignedTo)
      .sort((a: any, b: any) => {
        // 兼容历史版本的字符串优先级
        const priorityOrder: { [key: string]: number } = {
          'urgent': 0,
          'high': 1,
          'normal': 2,
          'low': 3
        };
        
        const aPriority = typeof a.priority === 'string' ? priorityOrder[a.priority] : a.priority;
        const bPriority = typeof b.priority === 'string' ? priorityOrder[b.priority] : b.priority;
        
        return aPriority - bPriority;
      });
    
    // 分配任务
    for (const task of pendingTasks) {
      if (freeCarriers.length === 0) break;
      
      // 根据任务类型选择合适的搬运工
      let suitableCarrier = null;
      
      if ([TaskType.SUPPLY_SPAWN, TaskType.SUPPLY_EXTENSION].includes((task as any).type)) {
        // 需要能量的任务
        suitableCarrier = freeCarriers.find(c => c.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
      } else if ([TaskType.WITHDRAW_ENERGY, TaskType.COLLECT_DROPPED].includes((task as any).type)) {
        // 获取能量的任务
        suitableCarrier = freeCarriers.find(c => c.store.getUsedCapacity(RESOURCE_ENERGY) === 0);
      } else if ([TaskType.ASSIST_HARVESTER, TaskType.ASSIST_UPGRADER].includes((task as any).type)) {
        // 搬运任务不需要能量，任何搬运工都可以
        suitableCarrier = freeCarriers[0];
      }
      
      if (!suitableCarrier) {
        suitableCarrier = freeCarriers[0]; // 没有合适的就用第一个
      }
      
      if (suitableCarrier) {
        // 分配任务
        (task as any).assignedTo = suitableCarrier.id;
        (task as any).status = 'assigned';  // 兼容现有角色代码
        (suitableCarrier.memory as any).currentTaskId = (task as any).id;
        (roomMemory as any).tasks[(task as any).id] = task;
        
        // 从空闲列表移除
        const index = freeCarriers.indexOf(suitableCarrier);
        freeCarriers.splice(index, 1);
        
        console.log(`[任务系统] ${suitableCarrier.name} <- ${(task as any).type}`);
      }
    }
  }

  // 3. 清理任务 - 删除无效任务，兼容历史版本
  private static cleanupTasks(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = (roomMemory as any).tasks || {};
    
    for (const [taskId, task] of Object.entries(tasks)) {
      const t = task as any;
      let shouldDelete = false;
      
      // 兼容历史版本的任务完成检查
      if (t.type === 'assistStaticHarvester') {
        const harvester = Game.getObjectById(t.harvesterId) as Creep;
        if (!harvester || (harvester.memory as any).working === true) {
          shouldDelete = true;
        }
      } else if (t.type === 'assistStaticUpgrader') {
        const upgrader = Game.getObjectById(t.upgraderId) as Creep;
        if (!upgrader || (upgrader.memory as any).working === true) {
          shouldDelete = true;
        }
      } else {
        // 其他任务类型的清理
        if (t.targetId && !Game.getObjectById(t.targetId)) {
          shouldDelete = true;
        }
      }
      
      // 分配的搬运工死亡
      if (t.assignedTo && !Game.getObjectById(t.assignedTo)) {
        shouldDelete = true;
      }
      
      // 任务过期
      if (Game.time - t.createdAt > 500) {
        shouldDelete = true;
      }
      
      if (shouldDelete) {
        delete (roomMemory as any).tasks[taskId];
      }
    }
  }

  // 辅助方法 - 兼容历史版本字段
  private static hasTask(room: Room, type: TaskType, targetId: string): boolean {
    const roomMemory = this.getRoomMemory(room);
    const tasks = (roomMemory as any).tasks || {};
    
    return Object.values(tasks).some((task: any) => {
      if (task.type === type) {
        // 兼容历史版本的字段名
        if (type === TaskType.ASSIST_HARVESTER) {
          return task.harvesterId === targetId;
        } else if (type === TaskType.ASSIST_UPGRADER) {
          return task.upgraderId === targetId;
        } else {
          return task.targetId === targetId;
        }
      }
      return false;
    });
  }
  
  private static hasEnergyCarriers(room: Room): boolean {
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'carrier' &&
                   c.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    return carriers.length >= 1;
  }

  // 创建矿工任务 - 兼容历史版本结构
  private static createHarvesterTask(room: Room, data: any): void {
    const roomMemory = this.getRoomMemory(room);
    const taskId = `${room.name}_transport_${data.harvesterId}`;
    
    const task = {
      id: taskId,
      type: data.type,
      priority: 'urgent',
      status: 'pending',
      roomName: room.name,
      createdAt: Game.time,
      expiresAt: Game.time + 200,
      harvesterId: data.harvesterId,
      targetPosition: data.targetPosition,
      harvesterPosition: data.harvesterPosition,
      assignedTo: null,
      assignedAt: null,
      completedAt: null,
      errorMessage: null
    };
    
    (roomMemory as any).tasks[taskId] = task;
    console.log(`[任务系统] 创建矿工任务: ${taskId} 目标:${data.harvesterId}`);
  }

  // 创建升级者任务 - 兼容历史版本结构
  private static createUpgraderTask(room: Room, data: any): void {
    const roomMemory = this.getRoomMemory(room);
    const taskId = `${room.name}_upgrader_transport_${data.upgraderId}`;
    
    const task = {
      id: taskId,
      type: data.type,
      priority: 'urgent',
      status: 'pending',
      roomName: room.name,
      createdAt: Game.time,
      expiresAt: Game.time + 200,
      upgraderId: data.upgraderId,
      targetPosition: data.targetPosition,
      upgraderPosition: data.upgraderPosition,
      assignedTo: null,
      assignedAt: null,
      completedAt: null,
      errorMessage: null
    };
    
    (roomMemory as any).tasks[taskId] = task;
    console.log(`[任务系统] 创建升级者任务: ${taskId} 目标:${data.upgraderId}`);
  }

  private static createTask(room: Room, data: Partial<Task>): void {
    const roomMemory = this.getRoomMemory(room);
    const taskId = `${data.type}_${Game.time}_${Math.random().toString(36).substr(2, 5)}`;
    
    const task: Task = {
      id: taskId,
      type: data.type!,
      priority: data.priority!,
      targetId: data.targetId!,
      createdAt: Game.time
    };
    
    if (data.targetPos) {
      task.targetPos = data.targetPos;
    }
    
    (roomMemory as any).tasks[taskId] = task;
  }

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

  // 公共API
  public static getCreepTask(creep: Creep): Task | null {
    const taskId = (creep.memory as any).currentTaskId;
    if (!taskId) return null;
    
    const roomMemory = this.getRoomMemory(creep.room);
    const task = (roomMemory as any).tasks[taskId];
    
    if (!task) {
      // 任务不存在，清理creep的任务ID
      delete (creep.memory as any).currentTaskId;
      return null;
    }
    
    // 如果任务存在且状态是assigned，标记为执行中
    if (task.status === 'assigned') {
      task.status = 'IN_PROGRESS';
      (roomMemory as any).tasks[taskId] = task;
    }
    
    return task;
  }

  public static completeTask(creep: Creep): void {
    const taskId = (creep.memory as any).currentTaskId;
    if (!taskId) return;
    
    const roomMemory = this.getRoomMemory(creep.room);
    delete (roomMemory as any).tasks[taskId];
    delete (creep.memory as any).currentTaskId;
    
    console.log(`[任务系统] ${creep.name} 完成任务`);
  }
  
  // 调试方法
  public static debugRoomTasks(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = (roomMemory as any).tasks || {};
    const taskCount = Object.keys(tasks).length;
    
    console.log(`[任务系统] 房间 ${room.name}: ${taskCount} 个任务`);
    
    for (const task of Object.values(tasks) as Task[]) {
      const assignee = task.assignedTo ? Game.creeps[task.assignedTo]?.name || '已死亡' : '待分配';
      console.log(`  ${task.type} -> ${assignee}`);
    }
  }
}