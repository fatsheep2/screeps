import { updateMiningSpots } from './miningSpotManager';
import { updateBuildingLayout, updateRoadPlanning } from './buildingManager';
import { spawnCreeps } from './spawnManager';
import { manageCombatProduction, organizeCombatSquads, updateCombatSquads } from './combatManager';
import { updateAttackTasks } from './attackManager';
import { updateProductionPlan } from './productionManager';
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
  // 更新智能生产计划（每50tick更新一次以避免频繁调整）
  if (Game.time % 50 === 0) {
    updateProductionPlan(room);
    updateMiningSpots(room);
    updateBuildingLayout(room);
  }

  // 统计当前各角色数量
  const creepCounts = countRoomCreeps(room);

  // 检查是否已建立基础兵种
  const hasBasic = hasBasicCreeps(creepCounts);

  // 尝试生产新 Creep（现在使用智能计划）
  spawnCreeps(room, creepCounts, hasBasic);

  // 管理战斗单位生产
  manageCombatProduction(room, hasBasic);

  // 静态矿工管理现在由任务系统处理

  // 只有在有基础单位时才执行战斗相关逻辑
  if (hasBasic) {
    // 编组战斗小组
    organizeCombatSquads(room);

    // 更新战斗小组状态
    updateCombatSquads(room);

    // 更新攻击任务状态
    updateAttackTasks();
  }

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
    } else if (task.type === 'assistStaticUpgrader') {
      const upgrader = Game.getObjectById(task.upgraderId) as Creep;
      if (!upgrader || upgrader.memory.working === true) {
        tasksToDelete.push(task.id);
        console.log(`[房间管理器] 升级者任务完成，删除: ${task.id}`);
      }
    } else if (task.type === 'collectEnergy') {
      const target = Game.getObjectById(task.targetId);
      if (!target) {
        tasksToDelete.push(task.id);
        console.log(`[房间管理器] 收集目标不存在，删除: ${task.id}`);
      }
    } else if (task.type === 'transferEnergy') {
      // 清理所有transfer任务，改为搬运工自主决策
      tasksToDelete.push(task.id);
      console.log(`[房间管理器] 清理transfer任务，改为自主决策: ${task.id}`);
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

// 完整的任务系统 - 优化版
function updateTaskSystemWithNewManager(room: Room): void {
  // 1. 扫描静态矿工，创建搬运任务（优先级：urgent）
  scanStaticHarvestersForTransport(room);

  // 2. 扫描静态升级者，创建搬运任务（优先级：urgent）
  scanStaticUpgradersForTransport(room);

  // 3. 扫描掉落资源，创建收集任务（优先级：high）
  scanDroppedResourcesForCollection(room);

  // 4. 扫描spawn/extension能量需求（优先级：high）
  scanSpawnExtensionEnergyNeeds(room);

  // 5. 扫描creep能量请求（优先级：normal）
  scanCreepEnergyRequests(room);

  // 6. 清理过期和失效任务
  cleanupCompletedTransportTasks(room);

  // 7. 主动分配任务给空闲的搬运工
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

  // 按优先级排序任务 - 矿工搬运优先策略
  const priorityOrder: { [key: string]: number } = {
    'urgent': 0,    // 矿工搬运（生产基础）
    'high': 1,      // 大量能量收集
    'normal': 2,    // Spawn/Extension转移、Tower转移、普通能量收集
    'low': 3        // 其他任务
  };

  pendingTasks.sort((a: any, b: any) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // 同优先级时，按任务类型排序
    const typeOrder: { [key: string]: number } = {
      'assistStaticHarvester': 0,  // 矿工搬运优先
      'assistStaticUpgrader': 1,   // 升级者搬运其次
      'transferEnergy': 2,         // 能量转移其次
      'collectEnergy': 3           // 能量收集最后
    };

    return typeOrder[a.type] - typeOrder[b.type];
  });

  // 为每个待分配的任务找一个空闲的搬运工
  for (const task of pendingTasks) {
    // 智能选择搬运工（针对供给任务优化）
    const availableCarrier = selectBestCarrierForTask(carriers, task as any);

    if (availableCarrier) {
      // 分配任务
      availableCarrier.memory.currentTaskId = task.id;
      task.assignedTo = availableCarrier.id;
      task.assignedAt = Game.time;
      task.status = 'assigned';

      // 更新房间内存中的任务
      roomMemory.tasks![task.id] = task;

      console.log(`[房间管理器] 分配任务 ${task.type}:${task.id} 给搬运工 ${availableCarrier.name}`);
    } else {
      console.log(`[房间管理器] 没有空闲搬运工执行任务 ${task.type}:${task.id}`);
    }
  }
}

// 智能选择最合适的搬运工执行任务
function selectBestCarrierForTask(carriers: Creep[], task: any): Creep | null {
  // 先过滤出空闲的搬运工
  const availableCarriers = carriers.filter(carrier => !carrier.memory.currentTaskId);

  if (availableCarriers.length === 0) {
    return null; // 没有空闲搬运工
  }

  // 判断是否为供给任务
  const isSupplyTask = task.type === 'supplyEnergy' ||
                      task.type === 'deliverToSpawn' ||
                      task.type === 'deliverToCreep';

  if (!isSupplyTask) {
    // 非供给任务，使用原有逻辑：选择第一个空闲的
    return availableCarriers[0];
  }

  // 供给任务的智能选择逻辑
  const requiredAmount = task.requiredAmount || 50;

  // 第一优先级：寻找能量充足的搬运工
  const energySufficientCarriers = availableCarriers.filter(carrier =>
    carrier.store.getUsedCapacity(RESOURCE_ENERGY) >= requiredAmount
  );

  if (energySufficientCarriers.length > 0) {
    // 有能量充足的搬运工，选择距离最近的
    const taskPosition = getTaskPosition(task);
    if (taskPosition) {
      const closest = taskPosition.findClosestByPath(energySufficientCarriers);
      if (closest) {
        console.log(`[任务分配] 选择能量充足的搬运工 ${closest.name} (${closest.store.getUsedCapacity(RESOURCE_ENERGY)}/${requiredAmount})`);
        return closest;
      }
    }

    // 如果无法计算距离，选择第一个能量充足的
    console.log(`[任务分配] 选择能量充足的搬运工 ${energySufficientCarriers[0].name}`);
    return energySufficientCarriers[0];
  }

  // 第二优先级：没有能量充足的搬运工，选择距离最近的
  const taskPosition = getTaskPosition(task);
  if (taskPosition) {
    const closest = taskPosition.findClosestByPath(availableCarriers);
    if (closest) {
      console.log(`[任务分配] 无充足能量搬运工，选择最近的 ${closest.name} (距离优先)`);
      return closest;
    }
  }

  // 最后兜底：选择第一个空闲的
  console.log(`[任务分配] 兜底选择搬运工 ${availableCarriers[0].name}`);
  return availableCarriers[0];
}

// 获取任务的位置信息
function getTaskPosition(task: any): RoomPosition | null {
  try {
    // 尝试从不同的位置字段获取坐标
    let x: number, y: number, roomName: string;

    if (task.position) {
      x = task.position.x;
      y = task.position.y;
      roomName = task.roomName;
    } else if (task.targetPosition) {
      x = task.targetPosition.x;
      y = task.targetPosition.y;
      roomName = task.roomName;
    } else if (task.targetId) {
      // 尝试从目标对象获取位置
      const target = Game.getObjectById(task.targetId);
      if (target && 'pos' in target) {
        return (target as any).pos;
      }
      return null;
    } else if (task.spawnId) {
      // 从spawn获取位置
      const spawn = Game.getObjectById(task.spawnId);
      if (spawn && 'pos' in spawn) {
        return (spawn as any).pos;
      }
      return null;
    } else if (task.creepId) {
      // 从creep获取位置
      const creep = Game.getObjectById(task.creepId);
      if (creep && 'pos' in creep) {
        return (creep as any).pos;
      }
      return null;
    } else {
      return null;
    }

    return new RoomPosition(x, y, roomName);
  } catch (error) {
    console.log(`[任务分配] 获取任务位置失败: ${error}`);
    return null;
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
    priority: 'urgent',
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

// 扫描静态升级者，创建搬运任务
function scanStaticUpgradersForTransport(room: Room): void {
  const staticUpgraders = room.find(FIND_MY_CREEPS, {
    filter: (c) => c.memory.role === 'upgrader' &&
                   c.memory.targetId &&
                   c.getActiveBodyparts(MOVE) == 0 &&
                   c.memory.working !== true
  });

  for (const upgrader of staticUpgraders) {
    // 检查是否已有搬运任务
    const existingTask = Object.values(room.memory.tasks || {}).find((task: any) =>
      task.type === 'assistStaticUpgrader' &&
      task.upgraderId === upgrader.id
    );

    if (!existingTask) {
      // 创建搬运任务
      const taskId = createUpgraderTransportTask(upgrader);
      if (taskId) {
        console.log(`[房间管理器] 为静态升级者 ${upgrader.name} 创建搬运任务: ${taskId}`);
      }
    }
  }
}

// 创建升级者搬运任务
function createUpgraderTransportTask(upgrader: Creep): string | null {
  if (!upgrader.memory.targetId) return null;

  const [targetX, targetY] = upgrader.memory.targetId.split(',').map(Number);
  const targetPos = new RoomPosition(targetX, targetY, upgrader.room.name);

  const task = {
    id: `${upgrader.room.name}_upgrader_transport_${upgrader.id}`,
    type: 'assistStaticUpgrader',
    priority: 'urgent',
    status: 'pending',
    roomName: upgrader.room.name,
    createdAt: Game.time,
    expiresAt: Game.time + 200,
    upgraderId: upgrader.id,
    targetPosition: { x: targetPos.x, y: targetPos.y },
    upgraderPosition: { x: upgrader.pos.x, y: upgrader.pos.y },
    assignedTo: null,
    assignedAt: null,
    completedAt: null,
    errorMessage: null
  };

  // 保存到房间内存
  if (!Memory.rooms[upgrader.room.name]) {
    Memory.rooms[upgrader.room.name] = {
      staticHarvesters: 0,
      upgraders: 0,
      builders: 0,
      carriers: 0,
      miningSpots: [],
      totalAvailableSpots: 0,
      tasks: {}
    };
  }

  if (!Memory.rooms[upgrader.room.name].tasks) {
    Memory.rooms[upgrader.room.name].tasks = {};
  }

  Memory.rooms[upgrader.room.name].tasks![task.id] = task;

  return task.id;
}

// 扫描掉落资源，创建收集任务（每5个tick扫描一次）
function scanDroppedResourcesForCollection(room: Room): void {
  // 限制扫描频率，避免重复创建任务
  if (Game.time % 5 !== 0) {
    return;
  }
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

  // 限制同时存在的收集任务数量
  const existingCollectTasks = Object.values(room.memory.tasks || {}).filter((task: any) =>
    task.type === 'collectEnergy'
  );

  if (existingCollectTasks.length >= 3) {
    return;
  }

  let createdCount = 0;
  for (const target of allTargets) {
    // 检查是否已有收集任务
    const existingTask = Object.values(room.memory.tasks || {}).find((task: any) =>
      task.type === 'collectEnergy' && task.targetId === target.id
    );

    if (!existingTask) {
      const taskId = createCollectEnergyTask(room, target);
      if (taskId) {
        console.log(`[房间管理器] 创建能量收集任务: ${taskId} 目标: ${target.id}`);
        createdCount++;

        // 每次扫描最多创建2个收集任务
        if (createdCount >= 2) {
          break;
        }
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

// 扫描建筑需求，创建能量转移任务（每10个tick扫描一次）
// 注意：此功能已禁用，改为搬运工自主决策
// function scanBuildingsForEnergyTransfer(room: Room): void {
//   // 限制扫描频率，避免重复创建任务
//   if (Game.time % 10 !== 0) {
//     return;
//   }
//   // 优先级顺序：Spawn > Extension > Tower > 其他
//   const priorityBuildings = [
//     // 1. Spawn和Extension（最高优先级）
//     ...room.find(FIND_STRUCTURES, {
//       filter: (structure) => {
//         return (structure.structureType === STRUCTURE_SPAWN ||
//                 structure.structureType === STRUCTURE_EXTENSION) &&
//                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
//       }
//     }),

//     // 2. 塔（高优先级）
//     ...room.find(FIND_STRUCTURES, {
//       filter: (structure) => {
//         return structure.structureType === STRUCTURE_TOWER &&
//                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 100;
//       }
//     })
//   ];

//   // 查找能量来源
//   const energySources = room.find(FIND_STRUCTURES, {
//     filter: (structure) => {
//       return (structure.structureType === STRUCTURE_CONTAINER ||
//               structure.structureType === STRUCTURE_STORAGE) &&
//              structure.store.getUsedCapacity(RESOURCE_ENERGY) > 100;
//     }
//   });

//   if (energySources.length === 0) {
//     return; // 没有能量来源
//   }

//   // 限制同时存在的transfer任务数量，避免任务爆炸
//   const existingTransferTasks = Object.values(room.memory.tasks || {}).filter((task: any) =>
//     task.type === 'transferEnergy'
//   );

//   // 如果已有5个或更多transfer任务，不再创建新的
//   if (existingTransferTasks.length >= 5) {
//     return;
//   }

//   for (const building of priorityBuildings) {
//     // 检查是否已有转移任务针对这个建筑
//     const existingTask = Object.values(room.memory.tasks || {}).find((task: any) =>
//       task.type === 'transferEnergy' && task.targetId === building.id
//     );

//     if (!existingTask) {
//       const nearestSource = building.pos.findClosestByRange(energySources);
//       if (nearestSource) {
//         const taskId = createTransferEnergyTask(room, nearestSource, building as StructureSpawn | StructureExtension | StructureTower | StructureContainer | StructureStorage);
//         if (taskId) {
//           console.log(`[房间管理器] 创建能量转移任务: ${taskId} ${nearestSource.id} -> ${building.id}`);
//         }

//         // 限制每次扫描只创建2个任务，避免一次性创建太多
//         if (Object.values(room.memory.tasks || {}).filter((task: any) =>
//           task.type === 'transferEnergy' && task.createdAt === Game.time
//         ).length >= 2) {
//           break;
//         }
//       }
//     }
//   }
// }

// 创建能量转移任务
// 注意：此功能已禁用，改为搬运工自主决策
// function createTransferEnergyTask(room: Room, source: Structure, target: StructureSpawn | StructureExtension | StructureTower | StructureContainer | StructureStorage): string | null {
//   let priority: string;

//   // 根据目标建筑设定优先级 - 转移优先级降低
//   if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) {
//     priority = 'normal';  // 降低到normal
//   } else if (target.structureType === STRUCTURE_TOWER) {
//     priority = 'normal';  // 降低到normal
//   } else {
//     priority = 'low';     // 其他建筑为low
//   }

//   const task = {
//     id: `${room.name}_transfer_${source.id}_${target.id}`,
//     type: 'transferEnergy',
//     priority: priority,
//     status: 'pending',
//     roomName: room.name,
//     createdAt: Game.time,
//     expiresAt: Game.time + 200,
//     sourceId: source.id,
//     sourceType: 'structure',
//     targetId: target.id,
//     targetCapacity: target.store.getFreeCapacity(RESOURCE_ENERGY),
//     assignedTo: null,
//     assignedAt: null,
//     completedAt: null,
//     errorMessage: null
//   };

//   // 保存到房间内存
//   if (!room.memory.tasks) {
//     room.memory.tasks = {};
//   }

//   room.memory.tasks[task.id] = task;
//   return task.id;
// }

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

// 扫描spawn/extension能量需求
function scanSpawnExtensionEnergyNeeds(room: Room): void {
  const roomMemory = Memory.rooms[room.name];
  if (!roomMemory || !roomMemory.tasks) return;

  // 限制任务数量，避免创建过多任务
  const existingSupplyTasks = Object.values(roomMemory.tasks).filter(
    task => task.type === 'supplyEnergy' || task.type === 'deliverToSpawn'
  ).length;

  if (existingSupplyTasks >= 3) {
    return; // 已有足够的供应任务
  }

  // 检查spawn能量需求（最高优先级）
  const spawns = room.find(FIND_MY_SPAWNS, {
    filter: spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });

  for (const spawn of spawns) {
    const existingTask = Object.values(roomMemory.tasks).find(
      task => task.type === 'deliverToSpawn' && (task as any).spawnId === spawn.id
    );

    if (!existingTask) {
      const taskId = `deliverToSpawn_${spawn.id}_${Game.time}`;
      roomMemory.tasks[taskId] = {
        id: taskId,
        type: 'deliverToSpawn',
        priority: 'high',
        status: 'pending',
        roomName: room.name,
        createdAt: Game.time,
        expiresAt: Game.time + 100,
        spawnId: spawn.id,
        position: { x: spawn.pos.x, y: spawn.pos.y },
        requiredAmount: spawn.store.getFreeCapacity(RESOURCE_ENERGY)
      };

      console.log(`[任务系统] 创建spawn能量配送任务: ${taskId}, 需求量: ${spawn.store.getFreeCapacity(RESOURCE_ENERGY)}`);
      return; // 一次只创建一个任务
    }
  }

  // 检查extension能量需求
  if (existingSupplyTasks < 2) {
    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === STRUCTURE_EXTENSION &&
                          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    if (extensions.length > 0) {
      const nearestExtension = room.find(FIND_MY_SPAWNS)[0]?.pos.findClosestByPath(extensions);

      if (nearestExtension) {
        const existingTask = Object.values(roomMemory.tasks).find(
          task => task.type === 'supplyEnergy' && (task as any).targetId === nearestExtension.id
        );

        if (!existingTask) {
          const taskId = `supplyEnergy_${nearestExtension.id}_${Game.time}`;
          roomMemory.tasks[taskId] = {
            id: taskId,
            type: 'supplyEnergy',
            priority: 'high',
            status: 'pending',
            roomName: room.name,
            createdAt: Game.time,
            expiresAt: Game.time + 100,
            targetId: nearestExtension.id,
            targetType: 'extension',
            position: { x: nearestExtension.pos.x, y: nearestExtension.pos.y },
            requiredAmount: (nearestExtension as StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY)
          };

          console.log(`[任务系统] 创建extension能量供应任务: ${taskId}`);
        }
      }
    }
  }
}

// 扫描creep能量请求
function scanCreepEnergyRequests(room: Room): void {
  const roomMemory = Memory.rooms[room.name];
  if (!roomMemory || !roomMemory.tasks) return;

  // 检查升级者和建筑者的能量请求
  const needEnergyCreeps = room.find(FIND_MY_CREEPS, {
    filter: creep => (creep.memory.role === 'upgrader' || creep.memory.role === 'builder') &&
                     creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                     (creep.memory as any).requestEnergy === true
  });

  for (const creep of needEnergyCreeps) {
    // 检查creep是否即将死亡（TTL < 50），如果是则跳过
    if (creep.ticksToLive && creep.ticksToLive < 50) {
      delete (creep.memory as any).requestEnergy;
      continue;
    }

    const existingTask = Object.values(roomMemory.tasks).find(
      task => task.type === 'deliverToCreep' && (task as any).creepId === creep.id
    );

    if (!existingTask) {
      const taskId = `deliverToCreep_${creep.name}_${Game.time}`;
      roomMemory.tasks[taskId] = {
        id: taskId,
        type: 'deliverToCreep',
        priority: 'normal',
        status: 'pending',
        roomName: room.name,
        createdAt: Game.time,
        expiresAt: Game.time + 50, // 较短的过期时间
        creepId: creep.id,
        creepName: creep.name,
        position: { x: creep.pos.x, y: creep.pos.y },
        requiredAmount: creep.store.getFreeCapacity(RESOURCE_ENERGY),
        requesterId: creep.id
      };

      console.log(`[任务系统] 创建creep能量配送任务: ${taskId} -> ${creep.name}`);

      // 清除请求标记
      delete (creep.memory as any).requestEnergy;
      return; // 一次只处理一个请求
    }
  }
}
