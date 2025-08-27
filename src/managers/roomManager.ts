import { updateMiningSpots } from './miningSpotManager';
import { updateBuildingLayout, updateRoadPlanning } from './buildingManager';
import { spawnCreeps } from './spawnManager';
import { manageCombatProduction, organizeCombatSquads, updateCombatSquads } from './combatManager';
import { updateAttackTasks } from './attackManager';
import { countRoomCreeps, hasBasicCreeps } from '../utils/creepUtils';
import { RoleUpgrader } from '../roles/upgrader';
import { RoleStaticHarvester } from '../roles/staticHarvester';
import { RoleBuilder } from '../roles/builder';
import { RoleCarrier } from '../roles/carrier';
import { RoleWarrior } from '../roles/warrior';
import { RoleTank } from '../roles/tank';
import { RoleArcher } from '../roles/archer';
import { RoleHealer } from '../roles/healer';

// 管理房间
export function manageRoom(room: Room): void {
  // 统计当前各角色数量
  const creepCounts = countRoomCreeps(room);

  // 检查是否已建立基础兵种
  const hasBasic = hasBasicCreeps(creepCounts);

  // 尝试生产新 Creep
  spawnCreeps(room, creepCounts, hasBasic);

  // 管理战斗单位生产
  manageCombatProduction(room);

  // 静态矿工管理现在由任务系统处理

  // 编组战斗小组
  organizeCombatSquads(room);

  // 更新战斗小组状态
  updateCombatSquads(room);

  // 更新攻击任务状态
  updateAttackTasks();

  // 更新任务系统
  updateTaskSystemWithNewManager(room);

  // 运行每个 Creep 的逻辑
  const roomCreeps = room.find(FIND_MY_CREEPS);
  for (const creep of roomCreeps) {
    runCreepRole(creep);
  }
}

// 清理已完成的任务
function cleanupCompletedTransportTasks(room: Room): void {
  const roomMemory = room.memory;
  if (!roomMemory || !roomMemory.tasks) return;

  const tasksToDelete: string[] = [];
  const tasksToReset: string[] = [];

  Object.values(roomMemory.tasks || {}).forEach((task: any) => {
    // 检查任务是否过期
    if (task.expiresAt && Game.time > task.expiresAt) {
      tasksToDelete.push(task.id);
      console.log(`[房间管理器] 任务过期，删除: ${task.id}`);
      return;
    }

    // 检查分配的搬运工是否还存在
    if (task.assignedTo && (task.status === 'assigned' || task.status === 'in_progress')) {
      const assignedCarrier = Game.getObjectById(task.assignedTo) as Creep;
      if (!assignedCarrier) {
        tasksToReset.push(task.id);
        return;
      }
    }

    // 不同类型任务的特定检查
    if (task.type === 'assistStaticHarvester') {
      const harvester = Game.getObjectById(task.harvesterId) as Creep;
      if (!harvester || harvester.memory.working === true) {
        tasksToDelete.push(task.id);
        console.log(`[房间管理器] 矿工任务完成，删除: ${task.id}`);
      }
    } else if (task.type === 'collectEnergy') {
      const target = Game.getObjectById(task.targetId);
      if (!target) {
        tasksToDelete.push(task.id);
        console.log(`[房间管理器] 收集目标不存在，删除: ${task.id}`);
      }
    } else if (task.type === 'transferEnergy') {
      const target = Game.getObjectById(task.targetId) as StructureSpawn | StructureExtension | StructureTower | StructureContainer | StructureStorage;
      if (!target || (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0)) {
        tasksToDelete.push(task.id);
        console.log(`[房间管理器] 转移目标已满或不存在，删除: ${task.id}`);
      }
    }
  });

  // 删除已完成/失效的任务
  tasksToDelete.forEach(taskId => {
    if (roomMemory.tasks) {
      delete roomMemory.tasks[taskId];
    }
  });

  // 重置失效分配的任务
  tasksToReset.forEach(taskId => {
    const task = roomMemory.tasks![taskId];
    if (task) {
      task.assignedTo = null;
      task.assignedAt = null;
      task.status = 'pending';
      console.log(`[房间管理器] 搬运工死亡，重置任务${taskId}到pending状态`);
    }
  });
}

// 完整的任务系统
function updateTaskSystemWithNewManager(room: Room): void {
  // 扫描静态矿工，创建搬运任务
  scanStaticHarvestersForTransport(room);

  // 扫描掉落资源，创建收集任务
  scanDroppedResourcesForCollection(room);

  // 扫描建筑需求，创建转移任务
  scanBuildingsForEnergyTransfer(room);

  // 清理已完成的任务
  cleanupCompletedTransportTasks(room);

  // 主动分配任务给空闲的搬运工
  assignPendingTasksToCarriers(room);
}

// 主动分配待处理任务给空闲的搬运工
function assignPendingTasksToCarriers(room: Room): void {
  // 获取所有搬运工
  const carriers = room.find(FIND_MY_CREEPS, {
    filter: (c) => c.memory.role === 'carrier'
  });

  if (carriers.length === 0) {
    return; // 没有搬运工
  }

  // 直接从房间内存获取待分配任务
  const roomMemory = Memory.rooms[room.name];
  if (!roomMemory || !roomMemory.tasks) {
    return;
  }

  const pendingTasks = Object.values(roomMemory.tasks).filter((task: any) =>
    task.status === 'pending' && !task.assignedTo
  );

  if (pendingTasks.length === 0) {
    return; // 没有待分配的任务
  }

  // 按优先级排序任务 - 细化优先级系统
  const priorityOrder: { [key: string]: number } = {
    'urgent': 0,    // Spawn/Extension转移
    'high': 1,      // 矿工搬运、Tower转移、大量能量收集
    'normal': 2,    // 普通能量收集
    'low': 3        // 其他任务
  };

  pendingTasks.sort((a: any, b: any) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // 同优先级时，按任务类型排序
    const typeOrder: { [key: string]: number } = {
      'assistStaticHarvester': 0,  // 矿工搬运优先
      'transferEnergy': 1,         // 能量转移其次
      'collectEnergy': 2           // 能量收集最后
    };

    return typeOrder[a.type] - typeOrder[b.type];
  });

  // 为每个待分配的任务找一个空闲的搬运工
  for (const task of pendingTasks) {
    // 寻找空闲的搬运工
    const availableCarrier = carriers.find(carrier => !carrier.memory.currentTaskId);

    if (availableCarrier) {
      // 分配任务
      availableCarrier.memory.currentTaskId = task.id;
      task.assignedTo = availableCarrier.id;
      task.assignedAt = Game.time;
      task.status = 'assigned';

      // 更新房间内存中的任务
      roomMemory.tasks![task.id] = task;
    }
  }
}

// 扫描静态矿工，创建搬运任务
function scanStaticHarvestersForTransport(room: Room): void {
  const staticHarvesters = room.find(FIND_MY_CREEPS, {
    filter: (c) => c.memory.role === 'staticHarvester' &&
                   c.memory.targetId &&
                   c.getActiveBodyparts(MOVE) == 0 &&
                   c.memory.working !== true
  });

  for (const harvester of staticHarvesters) {
    // 检查是否已有搬运任务
    const existingTask = Object.values(room.memory.tasks || {}).find((task: any) =>
      task.type === 'assistStaticHarvester' &&
      task.harvesterId === harvester.id
    );

    if (!existingTask) {
      // 创建搬运任务
      const taskId = createTransportTask(harvester);
      if (taskId) {
        console.log(`[房间管理器] 为静态矿工 ${harvester.name} 创建搬运任务: ${taskId}`);
      }
    }
  }
}

// 创建搬运任务
function createTransportTask(harvester: Creep): string | null {
  if (!harvester.memory.targetId) return null;

  const [targetX, targetY] = harvester.memory.targetId.split(',').map(Number);
  const targetPos = new RoomPosition(targetX, targetY, harvester.room.name);

  const task = {
    id: `${harvester.room.name}_transport_${harvester.id}`,
    type: 'assistStaticHarvester',
    priority: 'high',
    status: 'pending',
    roomName: harvester.room.name,
    createdAt: Game.time,
    expiresAt: Game.time + 200,
    harvesterId: harvester.id,
    targetPosition: { x: targetPos.x, y: targetPos.y },
    harvesterPosition: { x: harvester.pos.x, y: harvester.pos.y },
    assignedTo: null,
    assignedAt: null,
    completedAt: null,
    errorMessage: null
  };

  // 只保存到房间内存，砍掉任务管理器的垃圾同步
  if (!Memory.rooms[harvester.room.name]) {
    Memory.rooms[harvester.room.name] = {
      staticHarvesters: 0,
      upgraders: 0,
      builders: 0,
      carriers: 0,
      miningSpots: [],
      totalAvailableSpots: 0,
      tasks: {}
    };
  }
  if (!Memory.rooms[harvester.room.name].tasks) {
    Memory.rooms[harvester.room.name].tasks = {};
  }

  Memory.rooms[harvester.room.name].tasks![task.id] = task;

  return task.id;
}

// 扫描掉落资源，创建收集任务
function scanDroppedResourcesForCollection(room: Room): void {
  // 查找掉落的能量资源
  const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
  });

  // 查找墓碑中的能量
  const tombstones = room.find(FIND_TOMBSTONES, {
    filter: (tombstone) => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
  });

  // 查找废墟中的能量
  const ruins = room.find(FIND_RUINS, {
    filter: (ruin) => ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
  });

  const allTargets = [...droppedEnergy, ...tombstones, ...ruins];

  for (const target of allTargets) {
    // 检查是否已有收集任务
    const existingTask = Object.values(room.memory.tasks || {}).find((task: any) =>
      task.type === 'collectEnergy' && task.targetId === target.id
    );

    if (!existingTask) {
      const taskId = createCollectEnergyTask(room, target);
      if (taskId) {
        console.log(`[房间管理器] 创建能量收集任务: ${taskId} 目标: ${target.id}`);
      }
    }
  }
}

// 创建能量收集任务
function createCollectEnergyTask(room: Room, target: Resource | Tombstone | Ruin): string | null {
  let targetType: string;
  let energyAmount: number;

  if (target instanceof Resource) {
    targetType = 'dropped';
    energyAmount = target.amount;
  } else if ('body' in target) {
    targetType = 'tombstone';
    energyAmount = target.store.getUsedCapacity(RESOURCE_ENERGY);
  } else {
    targetType = 'ruin';
    energyAmount = target.store.getUsedCapacity(RESOURCE_ENERGY);
  }

  // 找到最近的存储建筑
  const storageTargets = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (structure.structureType === STRUCTURE_CONTAINER ||
              structure.structureType === STRUCTURE_STORAGE) &&
             structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    }
  });

  if (storageTargets.length === 0) {
    return null; // 没有存储地点
  }

  const nearestStorage = target.pos.findClosestByRange(storageTargets);
  if (!nearestStorage) return null;

  const task = {
    id: `${room.name}_collect_${target.id}`,
    type: 'collectEnergy',
    priority: energyAmount > 200 ? 'high' : 'normal',
    status: 'pending',
    roomName: room.name,
    createdAt: Game.time,
    expiresAt: Game.time + 300,
    targetId: target.id,
    targetType: targetType,
    storageTargetId: nearestStorage.id,
    energyAmount: energyAmount,
    assignedTo: null,
    assignedAt: null,
    completedAt: null,
    errorMessage: null
  };

  // 保存到房间内存
  if (!room.memory.tasks) {
    room.memory.tasks = {};
  }

  room.memory.tasks[task.id] = task;
  return task.id;
}

// 扫描建筑需求，创建能量转移任务
function scanBuildingsForEnergyTransfer(room: Room): void {
  // 优先级顺序：Spawn > Extension > Tower > 其他
  const priorityBuildings = [
    // 1. Spawn和Extension（最高优先级）
    ...room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return (structure.structureType === STRUCTURE_SPAWN ||
                structure.structureType === STRUCTURE_EXTENSION) &&
               structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }),

    // 2. 塔（高优先级）
    ...room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType === STRUCTURE_TOWER &&
               structure.store.getFreeCapacity(RESOURCE_ENERGY) > 100;
      }
    })
  ];

  // 查找能量来源
  const energySources = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (structure.structureType === STRUCTURE_CONTAINER ||
              structure.structureType === STRUCTURE_STORAGE) &&
             structure.store.getUsedCapacity(RESOURCE_ENERGY) > 100;
    }
  });

  if (energySources.length === 0) {
    return; // 没有能量来源
  }

  for (const building of priorityBuildings) {
    // 检查是否已有转移任务
    const existingTask = Object.values(room.memory.tasks || {}).find((task: any) =>
      task.type === 'transferEnergy' && task.targetId === building.id
    );

    if (!existingTask) {
      const nearestSource = building.pos.findClosestByRange(energySources);
      if (nearestSource) {
        const taskId = createTransferEnergyTask(room, nearestSource, building as StructureSpawn | StructureExtension | StructureTower | StructureContainer | StructureStorage);
        if (taskId) {
          console.log(`[房间管理器] 创建能量转移任务: ${taskId} ${nearestSource.id} -> ${building.id}`);
        }
      }
    }
  }
}

// 创建能量转移任务
function createTransferEnergyTask(room: Room, source: Structure, target: StructureSpawn | StructureExtension | StructureTower | StructureContainer | StructureStorage): string | null {
  let priority: string;

  // 根据目标建筑设定优先级
  if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) {
    priority = 'urgent';
  } else if (target.structureType === STRUCTURE_TOWER) {
    priority = 'high';
  } else {
    priority = 'normal';
  }

  const task = {
    id: `${room.name}_transfer_${source.id}_${target.id}`,
    type: 'transferEnergy',
    priority: priority,
    status: 'pending',
    roomName: room.name,
    createdAt: Game.time,
    expiresAt: Game.time + 200,
    sourceId: source.id,
    sourceType: 'structure',
    targetId: target.id,
    targetCapacity: target.store.getFreeCapacity(RESOURCE_ENERGY),
    assignedTo: null,
    assignedAt: null,
    completedAt: null,
    errorMessage: null
  };

  // 保存到房间内存
  if (!room.memory.tasks) {
    room.memory.tasks = {};
  }

  room.memory.tasks[task.id] = task;
  return task.id;
}

// 运行 Creep 角色逻辑
function runCreepRole(creep: Creep): void {
  // 使用类型断言确保role字段存在
  const role = (creep.memory as any).role;

  try {
    switch (role) {
      case 'upgrader':
        RoleUpgrader.run(creep);
        break;
      case 'staticHarvester':
        RoleStaticHarvester.run(creep);
        break;
      case 'builder':
        RoleBuilder.run(creep);
        break;
      case 'carrier':
        RoleCarrier.run(creep);
        break;
      case 'warrior':
        RoleWarrior.run(creep);
        break;
      case 'tank':
        RoleTank.run(creep);
        break;
      case 'archer':
        RoleArcher.run(creep);
        break;
      case 'healer':
        RoleHealer.run(creep);
        break;
      default:
        console.log(`未知的 Creep 角色: ${role}`);
    }
  } catch (error) {
    console.log(`运行 Creep ${creep.name} 角色 ${role} 时发生错误: ${error}`);
  }
}

// 初始化房间内存
export function initializeRoomMemory(room: Room): void {
  if (!Memory.rooms[room.name]) {
    Memory.rooms[room.name] = {
      staticHarvesters: 0,
      upgraders: 0,
      builders: 0,
      carriers: 0,
      miningSpots: [], // 记录可用的采矿点
      totalAvailableSpots: 0 // 记录总可用空地数量
    };
    console.log(`初始化房间 ${room.name} 的内存`);
  }
}

// 清理已死亡 Creep 的内存
export function cleanupDeadCreeps(): void {
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      console.log(`清理已死亡的 Creep: ${name}`);
    }
  }
}

// 更新房间状态
export function updateRoomStatus(room: Room): void {
  // 更新采矿点信息（每100tick刷新一次）
  if (Game.time % 100 === 0) {
    updateMiningSpots(room);
  }

  // 更新建筑布局建议
  updateBuildingLayout(room);

  // 更新道路规划
  updateRoadPlanning(room);

  // 任务系统现在由新的任务管理器处理
}
