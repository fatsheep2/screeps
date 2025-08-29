import { updateMiningSpots } from './miningSpotManager';
import { updateBuildingLayout } from './buildingManager';
import { spawnCreeps } from './spawnManager';
import { manageCombatProduction, organizeCombatSquads, updateCombatSquads } from './combatManager';
import { updateAttackTasks } from './attackManager';
import { updateProductionPlan } from './productionManager';
import { countRoomCreeps, hasBasicCreeps } from '../utils/creepUtils';
import { TaskSystem } from './taskSystem';
import { ScoutManager } from './scoutManager';
import { RoleUpgrader } from '../roles/upgrader';
import { RoleStaticHarvester } from '../roles/staticHarvester';
import { RoleBuilder } from '../roles/builder';
import { RoleCarrier } from '../roles/carrier';
import { RoleWarrior } from '../roles/warrior';
import { RoleTank } from '../roles/tank';
import { RoleArcher } from '../roles/archer';
import { RoleHealer } from '../roles/healer';
import { RoleScout } from '../roles/scout';

// 管理房间 - 简化版：删除所有垃圾设计
export function manageRoom(room: Room): void {
  // 更新智能生产计划（每50tick更新一次）
  if (Game.time % 50 === 0) {
    updateProductionPlan(room);
    updateMiningSpots(room);
    updateBuildingLayout(room);
  }

  // 统计当前各角色数量
  const creepCounts = countRoomCreeps(room);
  const hasBasic = hasBasicCreeps(creepCounts);

  // 生产新Creep
  spawnCreeps(room, creepCounts, hasBasic);

  // 管理战斗单位
  manageCombatProduction(room, hasBasic);

  // 战斗逻辑（仅在有基础单位时）
  if (hasBasic) {
    organizeCombatSquads(room);
    updateCombatSquads(room);
    updateAttackTasks();
  }

  // 新任务系统 - 一行代码替换1000行垃圾
  TaskSystem.update(room);

  // 管理侦察任务（每100tick更新一次）
  if (Game.time % 100 === 0) {
    ScoutManager.assignScoutTasks(room);
  }

  // 运行每个Creep的逻辑
  const roomCreeps = room.find(FIND_MY_CREEPS);
  for (const creep of roomCreeps) {
    runCreepRole(creep);
  }
}


// 运行Creep角色逻辑
function runCreepRole(creep: Creep): void {
  switch (creep.memory.role) {
    case 'staticHarvester':
      RoleStaticHarvester.run(creep);
      break;
    case 'carrier':
      RoleCarrier.run(creep);
      break;
    case 'upgrader':
      RoleUpgrader.run(creep);
      break;
    case 'builder':
      RoleBuilder.run(creep);
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
    case 'scout':
      RoleScout.run(creep);
      break;
    default:
      console.log(`[房间管理] 未知角色类型: ${creep.memory.role}`);
      break;
  }
}

// 文件末尾，无需重复导出