import { updateMiningSpots } from './miningSpotManager';
import { updateBuildingLayout, updateRoadPlanning } from './buildingManager';
import { updateTaskSystem, manageStaticHarvesters } from './taskManager';
import { spawnCreeps } from './spawnManager';
import { countRoomCreeps, hasBasicCreeps } from '../utils/creepUtils';
import { RoleUpgrader } from '../roles/upgrader';
import { RoleStaticHarvester } from '../roles/staticHarvester';
import { RoleBuilder } from '../roles/builder';
import { RoleCarrier } from '../roles/carrier';

// 管理房间
export function manageRoom(room: Room): void {
  // 统计当前各角色数量
  const creepCounts = countRoomCreeps(room);

  // 检查是否已建立基础兵种
  const hasBasic = hasBasicCreeps(creepCounts);

  // 尝试生产新 Creep
  spawnCreeps(room, creepCounts, hasBasic);

  // 管理静态矿工的放置
  manageStaticHarvesters(room);

  // 运行每个 Creep 的逻辑
  const roomCreeps = room.find(FIND_MY_CREEPS);
  for (const creep of roomCreeps) {
    runCreepRole(creep);
  }
}

// 运行 Creep 角色逻辑
function runCreepRole(creep: Creep): void {
  switch (creep.memory.role) {
    case 'staticHarvester':
      RoleStaticHarvester.run(creep);
      break;
    case 'upgrader':
      RoleUpgrader.run(creep);
      break;
    case 'builder':
      RoleBuilder.run(creep);
      break;
    case 'carrier':
      RoleCarrier.run(creep);
      break;
    default:
      // 未知角色，静默处理
      break;
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

  // 更新任务系统
  updateTaskSystem(room);
}
