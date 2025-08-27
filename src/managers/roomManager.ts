import { updateMiningSpots } from './miningSpotManager';
import { updateBuildingLayout, updateRoadPlanning } from './buildingManager';
import { spawnCreeps } from './spawnManager';
import { manageCombatProduction, organizeCombatSquads, updateCombatSquads } from './combatManager';
import { updateAttackTasks } from './attackManager';
import { countRoomCreeps, hasBasicCreeps } from '../utils/creepUtils';
import { getRoomTaskManager } from './taskManager';
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

// 清理已完成的搬运任务
function cleanupCompletedTransportTasks(room: Room, _taskManager: any): void {
  const roomMemory = room.memory;
  if (!roomMemory || !roomMemory.tasks) return;

  const tasksToDelete: string[] = [];

  // 检查所有搬运任务
  Object.values(roomMemory.tasks || {}).forEach((task: any) => {
    if (task.type === 'assistStaticHarvester') {
      const harvester = Game.getObjectById(task.harvesterId) as Creep;

      // 如果矿工不存在，或者已经在工作，删除任务
      if (!harvester || harvester.memory.working === true) {
        tasksToDelete.push(task.id);

        if (harvester && harvester.memory.working === true) {
          console.log(`[房间管理器] 矿工${harvester.name}已开始工作，删除搬运任务: ${task.id}`);
        } else if (!harvester) {
          console.log(`[房间管理器] 矿工不存在，删除搬运任务: ${task.id}`);
        }

        // 如果任务已分配给搬运工，清除搬运工的任务ID
        if (task.assignedTo) {
          const assignedCarrier = Game.creeps[task.assignedTo];
          if (assignedCarrier && assignedCarrier.memory.currentTaskId === task.id) {
            delete assignedCarrier.memory.currentTaskId;
            console.log(`[房间管理器] 清除搬运工${assignedCarrier.name}的任务ID`);
          }
        }
      }
    }
  });

  // 删除已完成的任务
  tasksToDelete.forEach(taskId => {
    if (roomMemory.tasks) {
      delete roomMemory.tasks[taskId];
      console.log(`[房间管理器] 删除已完成任务: ${taskId}`);
    }
  });
}

// 使用新的任务管理器更新任务系统
function updateTaskSystemWithNewManager(room: Room): void {
  const taskManager = getRoomTaskManager(room.name);

  // 让任务管理器监控任务状态（验证、超时检查、清理）
  taskManager.monitorTasks();

  // 扫描静态矿工，创建搬运任务
  scanStaticHarvestersForTransport(room, taskManager);

  // 清理已完成的搬运任务
  cleanupCompletedTransportTasks(room, taskManager);

  // 主动分配任务给空闲的搬运工
  assignPendingTasksToCarriers(room, taskManager);

  // 让任务管理器自己处理任务分配，避免冲突
}

// 主动分配待处理任务给空闲的搬运工
function assignPendingTasksToCarriers(room: Room, taskManager: any): void {
  // 强制重新加载任务状态，确保一致性
  if (taskManager && typeof taskManager.reloadTasks === 'function') {
    console.log(`[房间管理器] 强制重新加载任务状态，确保一致性`);
    taskManager.reloadTasks();
  }

  // 获取所有搬运工
  const carriers = room.find(FIND_MY_CREEPS, {
    filter: (c) => c.memory.role === 'carrier'
  });

  if (carriers.length === 0) {
    console.log(`[房间管理器] 没有找到搬运工，无法分配任务`);
    return; // 没有搬运工
  }

  // 获取所有待分配的任务
  const pendingTasks = taskManager.findTaskByFilter({
    status: 'pending'
  });

  if (pendingTasks.length === 0) {
    console.log(`[房间管理器] 没有待分配的任务`);
    return; // 没有待分配的任务
  }

  // 按优先级排序任务
  const priorityOrder: { [key: string]: number } = { 'urgent': 0, 'high': 1, 'normal': 2, 'low': 3 };
  pendingTasks.sort((a: any, b: any) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  let assignedCount = 0;

  // 显示当前状态，帮助调试
  console.log(`[房间管理器] 开始分配任务，有 ${carriers.length} 个搬运工，${pendingTasks.length} 个待分配任务`);

  // 显示待分配任务的详细信息
  console.log(`[房间管理器] 待分配任务列表:`);
  pendingTasks.forEach((task: any, index: number) => {
    console.log(`  ${index + 1}. ${task.type} (${task.priority}) - ${task.id}`);
  });

  // 显示所有搬运工的状态
  console.log(`[房间管理器] 搬运工状态列表:`);
  carriers.forEach((carrier, index) => {
    const hasTask = carrier.memory.currentTaskId ? '✅' : '❌';
    const energy = carrier.store.getUsedCapacity(RESOURCE_ENERGY);
    const capacity = carrier.store.getCapacity(RESOURCE_ENERGY);

    console.log(`  ${index + 1}. ${carrier.name} ${hasTask} 任务: ${carrier.memory.currentTaskId || '无'} | 能量: ${energy}/${capacity}`);
  });

  // 为每个待分配的任务找一个空闲的搬运工
  for (const task of pendingTasks) {
    console.log(`[房间管理器] 尝试分配任务 ${task.id} (${task.type})`);

    // 寻找空闲的搬运工
    const availableCarrier = carriers.find(carrier => {
      // 空闲判断：搬运工没有当前任务ID
      const isIdle = !carrier.memory.currentTaskId;

      // 调试信息
      if (carrier.name.includes('carrier')) {
        console.log(`[调试] 搬运工 ${carrier.name}: currentTaskId=${carrier.memory.currentTaskId}, 空闲=${isIdle}`);
      }

      return isIdle;
    });

    if (availableCarrier) {
      // 直接分配任务
      assignedCount++;
      console.log(`[房间管理器] 分配任务 ${task.id} (${task.type}) 给搬运工 ${availableCarrier.name}`);

      // 更新搬运工内存
      availableCarrier.memory.currentTaskId = task.id;
      availableCarrier.memory.working = true;

      // 更新任务状态
      task.assignedTo = availableCarrier.id;
      task.assignedAt = Game.time;
      task.status = 'assigned';

      // 同步更新房间内存中的任务状态
      if (room.memory.tasks && room.memory.tasks[task.id]) {
        room.memory.tasks[task.id] = task;
        console.log(`[房间管理器] 更新房间内存中任务 ${task.id} 的 assignedTo: ${availableCarrier.id}`);
      } else {
        console.log(`[警告] 房间内存中没有找到任务 ${task.id}，无法同步状态`);
      }

      // 通知任务管理器更新状态
      try {
        if (taskManager && typeof taskManager.updateTaskAssignment === 'function') {
          taskManager.updateTaskAssignment(task.id, availableCarrier.id, 'assigned');
          console.log(`[房间管理器] 通知任务管理器任务 ${task.id} 分配给: ${availableCarrier.id}`);
        } else if (taskManager && typeof taskManager.updateTaskStatus === 'function') {
          // 兼容旧版本
          taskManager.updateTaskStatus(task.id, 'assigned');
          console.log(`[房间管理器] 使用兼容方式更新任务状态: ${task.id}`);
        }
      } catch (error) {
        console.log(`[房间管理器] 通知任务管理器失败: ${error}`);
      }

      // 验证任务分配是否成功
      console.log(`[房间管理器] 任务 ${task.id} 分配完成，assignedTo: ${task.assignedTo}, status: ${task.status}`);
    } else {
      console.log(`[房间管理器] 没有找到空闲搬运工来分配任务 ${task.id}`);
    }
  }

  if (assignedCount > 0) {
    console.log(`[房间管理器] 分配了 ${assignedCount} 个任务给搬运工`);
  } else {
    console.log(`[房间管理器] 没有成功分配任何任务`);
  }

  // 显示未分配任务的统计
  const unassignedTasks = pendingTasks.filter((t: any) => !t.assignedTo);
  if (unassignedTasks.length > 0) {
    console.log(`[房间管理器] 还有 ${unassignedTasks.length} 个任务未分配`);

    // 显示搬运工状态
    console.log(`\n搬运工状态:`);
    carriers.forEach((carrier, index) => {
      const hasTask = carrier.memory.currentTaskId ? '✅' : '❌';
      const energy = carrier.store.getUsedCapacity(RESOURCE_ENERGY);
      const capacity = carrier.store.getCapacity(RESOURCE_ENERGY);

      console.log(`  ${index + 1}. ${carrier.name} ${hasTask} 任务: ${carrier.memory.currentTaskId || '无'} | 能量: ${energy}/${capacity}`);
    });
  }
}

// 扫描静态矿工，创建搬运任务
function scanStaticHarvestersForTransport(room: Room, taskManager: any): void {
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
      const taskId = createTransportTask(harvester, taskManager);
      if (taskId) {
        console.log(`[房间管理器] 为静态矿工 ${harvester.name} 创建搬运任务: ${taskId}`);
      }
    }
  }
}

// 创建搬运任务
function createTransportTask(harvester: Creep, taskManager: any): string | null {
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

  // 保存到房间内存
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

  // 同时通知任务管理器，确保状态同步
  try {
    if (taskManager && typeof taskManager.addTask === 'function') {
      // 使用新的 addTask 方法直接添加任务到管理器
      taskManager.addTask(task);
      console.log(`[房间管理器] 成功同步任务到任务管理器: ${task.id}`);
    } else if (taskManager && typeof taskManager.createAssistStaticHarvesterTask === 'function') {
      // 兼容旧版本
      taskManager.createAssistStaticHarvesterTask(harvester, 'high');
      console.log(`[房间管理器] 使用兼容方式创建搬运任务: ${task.id}`);
    } else {
      console.log(`[警告] 任务管理器不支持任务创建，状态可能不同步: ${task.id}`);
    }
  } catch (error) {
    console.log(`[房间管理器] 通知任务管理器创建搬运任务失败: ${error}`);
  }

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
