import { COMBAT_ROLES } from '../config/combatConfig';
import { getOptimalCombatBodyParts, countCombatCreeps } from '../utils/combatUtils';

// 战斗小组内存结构
export interface CombatSquad {
  id: string;
  members: {
    [COMBAT_ROLES.TANK]: string;      // 坦克
    [COMBAT_ROLES.WARRIOR]: string;   // 战士
    [COMBAT_ROLES.ARCHER]: string;    // 弓箭手
    [COMBAT_ROLES.HEALER]: string;    // 牧师
  };
  status: 'forming' | 'ready' | 'engaged' | 'retreating';
  target?: string; // 目标敌人或位置
  formationTime: number;
}

// 管理战斗单位生产
export function manageCombatProduction(room: Room, hasBasic: boolean = false): void {
  // 如果没有基础单位，不生产战斗单位
  if (!hasBasic) {
    return;
  }

  const spawns = room.find(FIND_MY_SPAWNS);
  const availableSpawn = spawns.find(spawn => !spawn.spawning);

  if (!availableSpawn) return;

  const roomEnergy = room.energyAvailable;
  const combatCounts = countCombatCreeps(room);

  // 只维戰1个tank用于测试，简化逻辑
  const maxTanks = 1;
  if (combatCounts[COMBAT_ROLES.TANK] < maxTanks) {
    const bodyParts = getOptimalCombatBodyParts(COMBAT_ROLES.TANK, roomEnergy);
    if (bodyParts.length > 0) {
      const name = `${COMBAT_ROLES.TANK}_${Game.time}_${Math.floor(Math.random() * 1000)}`;
      const result = availableSpawn.spawnCreep(bodyParts, name, {
        memory: {
          role: COMBAT_ROLES.TANK,
          room: room.name,
          working: false
          // 简化tank，不需要复杂的队长标记
        }
      });

      if (result === OK) {
        console.log(`生产测试tank: ${name}`);
        return;
      }
    }
  }

  // 注释掉其他战斗单位的生成，只保留tank用于测试
  /*
  if (!hasCompleteCombatSquad(combatCounts)) {
    // 优先生产队长（坦克）
    if (combatCounts[COMBAT_ROLES.TANK] === 0) {
      const bodyParts = getOptimalCombatBodyParts(COMBAT_ROLES.TANK, roomEnergy);
      if (bodyParts.length > 0) {
        const name = `${COMBAT_ROLES.TANK}_${Game.time}_${Math.floor(Math.random() * 1000)}`;
        const result = availableSpawn.spawnCreep(bodyParts, name, {
          memory: {
            role: COMBAT_ROLES.TANK,
            room: room.name,
            working: false,
            isLeader: true // 标记为队长
          }
        });

        if (result === OK) {
          console.log(`生产战斗队长: ${COMBAT_ROLES.TANK} - ${name}`);
          return;
        }
      }
    }

    // 然后按优先级生产其他缺失的战斗单位
    const missingRoles = SQUAD_ROLES.filter(role => combatCounts[role] === 0);
    for (const role of missingRoles) {
      const bodyParts = getOptimalCombatBodyParts(role, roomEnergy);
      if (bodyParts.length > 0) {
        const name = `${role}_${Game.time}_${Math.floor(Math.random() * 1000)}`;
        const result = availableSpawn.spawnCreep(bodyParts, name, {
          memory: {
            role: role,
            room: room.name,
            working: false
          }
        });

        if (result === OK) {
          console.log(`生产战斗单位: ${role} - ${name}`);
          return;
        }
      }
    }
  }
  */
}

// 编组战斗小组 - 注释掉用于测试，只保留tank
export function organizeCombatSquads(_room: Room): void {
  return;
}

// 更新战斗小组状态
export function updateCombatSquads(_room: Room): void {
  if (!Memory.combatSquads) return;

  for (const squadId in Memory.combatSquads) {
    const squad = Memory.combatSquads[squadId];

    // 检查小组成员是否都存活
    const allMembersAlive = Object.values(squad.members).every(memberName =>
      memberName && Game.creeps[memberName]
    );

    if (!allMembersAlive) {
      // 有成员死亡，解散小组
      console.log(`战斗小组 ${squadId} 有成员死亡，解散小组`);
      delete Memory.combatSquads[squadId];

      // 清理其他成员的小组ID
      Object.values(squad.members).forEach(memberName => {
        if (memberName && Game.creeps[memberName]) {
          delete Game.creeps[memberName].memory.squadId;
        }
      });
      continue;
    }

    // 更新小组状态
    if (squad.status === 'forming' && Game.time - squad.formationTime > 10) {
      squad.status = 'ready';
      console.log(`战斗小组 ${squadId} 准备就绪！`);
    }
  }
}

// 获取房间的战斗小组信息
export function getRoomCombatSquads(_room: Room): CombatSquad[] {
  // 简化的战斗系统不使用编组，直接返回空数组
  // 新的简化攻击命令直接使用tank单体
  return [];
}

// 手动更新编组状态
export function forceUpdateSquadStatus(squadId: string): void {
  if (!Memory.combatSquads || !Memory.combatSquads[squadId]) {
    console.log(`编组 ${squadId} 不存在`);
    return;
  }

  const squad = Memory.combatSquads[squadId];
  const oldStatus = squad.status;

  console.log(`[编组管理] 强制更新编组 ${squadId} 状态: ${oldStatus} -> ready`);
  console.log(`[编组管理] 编组 ${squadId} 成员: ${JSON.stringify(squad.members)}`);

  // 检查小组成员是否都存活
  const allMembersAlive = Object.values(squad.members).every(memberName => {
    if (!memberName) return false;
    const member = Game.creeps[memberName];
    const alive = member && member.hits > 0;
    console.log(`[编组管理] 成员 ${memberName}: ${alive ? '存活' : '死亡/不存在'} (${member?.hits || 0}/${member?.hitsMax || 0})`);
    return alive;
  });

  if (!allMembersAlive) {
    console.log(`[编组管理] 编组 ${squadId} 有成员死亡，无法更新状态`);
    return;
  }

  // 强制更新状态为ready
  if (squad.status === 'forming') {
    squad.status = 'ready';
    console.log(`[编组管理] 编组 ${squadId} 状态已强制更新为 ready`);

    // 重置编队状态
    (squad as any).formationComplete = false;
    (squad as any).formationCenter = null;
    (squad as any).moveTarget = null;
    (squad as any).lastMoveTime = null;
    console.log(`[编组管理] 重置编组 ${squadId} 编队状态`);
  } else {
    console.log(`[编组管理] 编组 ${squadId} 当前状态为 ${squad.status}，无需更新`);
  }
}

// 检查房间是否需要战斗单位
export function needsCombatUnits(room: Room): boolean {
  // 检查是否有敌对Creep
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  if (hostiles.length > 0) return true;

  // 检查是否有敌对建筑
  const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
  if (hostileStructures.length > 0) return true;

  return false;
}
