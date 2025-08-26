import { COMBAT_ROLES, SQUAD_ROLES } from '../config/combatConfig';
import { getOptimalCombatBodyParts, countCombatCreeps, hasCompleteCombatSquad } from '../utils/combatUtils';

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
export function manageCombatProduction(room: Room): void {
  const spawns = room.find(FIND_MY_SPAWNS);
  const availableSpawn = spawns.find(spawn => !spawn.spawning);

  if (!availableSpawn) return;

  const roomEnergy = room.energyAvailable;
  const combatCounts = countCombatCreeps(room);

  // 检查是否需要生产战斗单位
  if (!hasCompleteCombatSquad(combatCounts)) {
    // 按优先级生产缺失的战斗单位
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
}

// 编组战斗小组
export function organizeCombatSquads(room: Room): void {
  const combatCreeps = room.find(FIND_MY_CREEPS, {
    filter: creep => creep.memory.role && Object.values(COMBAT_ROLES).includes(creep.memory.role as any)
  });

  // 按角色分组
  const roleGroups: Record<string, Creep[]> = {};
  for (const role of Object.values(COMBAT_ROLES)) {
    roleGroups[role] = combatCreeps.filter(creep => creep.memory.role === role);
  }

  // 寻找未编组的战斗单位（用于调试）
  // const unassignedCreeps = combatCreeps.filter(creep => !creep.memory.squadId);

  // 尝试编组新的战斗小组
  for (const role of SQUAD_ROLES) {
    const availableCreeps = roleGroups[role].filter(creep => !creep.memory.squadId);

    if (availableCreeps.length > 0) {
      // 检查其他角色是否也有可用的单位
      const canFormSquad = SQUAD_ROLES.every(r =>
        roleGroups[r].filter(c => !c.memory.squadId).length > 0
      );

      if (canFormSquad) {
        const squadId = `squad_${Game.time}_${Math.floor(Math.random() * 1000)}`;

        // 为每个角色分配一个单位到战斗小组
        for (const squadRole of SQUAD_ROLES) {
          const creep = roleGroups[squadRole].find(c => !c.memory.squadId);
          if (creep) {
            creep.memory.squadId = squadId;
            console.log(`战斗单位 ${creep.name} 加入战斗小组 ${squadId}`);
          }
        }

        // 创建战斗小组内存记录
        if (!Memory.combatSquads) Memory.combatSquads = {};
        Memory.combatSquads[squadId] = {
          id: squadId,
          members: {
            [COMBAT_ROLES.TANK]: roleGroups[COMBAT_ROLES.TANK].find(c => c.memory.squadId === squadId)?.name || '',
            [COMBAT_ROLES.WARRIOR]: roleGroups[COMBAT_ROLES.WARRIOR].find(c => c.memory.squadId === squadId)?.name || '',
            [COMBAT_ROLES.ARCHER]: roleGroups[COMBAT_ROLES.ARCHER].find(c => c.memory.squadId === squadId)?.name || '',
            [COMBAT_ROLES.HEALER]: roleGroups[COMBAT_ROLES.HEALER].find(c => c.memory.squadId === squadId)?.name || ''
          },
          status: 'forming',
          formationTime: Game.time
        };

        console.log(`战斗小组 ${squadId} 组建完成！`);
      }
    }
  }
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
export function getRoomCombatSquads(room: Room): CombatSquad[] {
  if (!Memory.combatSquads) return [];

  console.log(`[编组管理] 检查房间 ${room.name} 的可用战斗编组，总编组数: ${Object.keys(Memory.combatSquads).length}`);

  const availableSquads = Object.values(Memory.combatSquads).filter(squad => {
    console.log(`[编组管理] 检查编组 ${squad.id}: 状态=${squad.status}, 成员数=${Object.keys(squad.members).length}`);

    // 检查编组状态是否为ready或forming（允许使用forming状态的编组）
    if (squad.status !== 'ready' && squad.status !== 'forming') {
      console.log(`[编组管理] 编组 ${squad.id} 状态为 ${squad.status}，不可用`);
      return false;
    }

    // 检查编组是否有足够的存活成员
    const aliveMembers = Object.values(squad.members).filter(memberName => {
      if (!memberName) return false;
      const member = Game.creeps[memberName];
      const alive = member && member.hits > 0;
      console.log(`[编组管理] 成员 ${memberName}: ${alive ? '存活' : '死亡/不存在'} (${member?.room.name || 'null'})`);
      return alive;
    });

    // 至少需要3个成员存活
    if (aliveMembers.length < 3) {
      console.log(`[编组管理] 编组 ${squad.id} 只有 ${aliveMembers.length} 个存活成员，不可用`);
      return false;
    }

    // 检查是否有成员在指定房间（作为编组的"主场"）
    const hasMemberInRoom = aliveMembers.some(memberName => {
      const creep = Game.creeps[memberName];
      const inRoom = creep && creep.room.name === room.name;
      console.log(`[编组管理] 成员 ${memberName}: ${inRoom ? '在房间' : '不在房间'} (${creep?.room.name || 'null'})`);
      return inRoom;
    });

    // 检查是否有活跃的攻击任务
    const hasActiveAttackTask = Memory.attackTasks &&
      Object.values(Memory.attackTasks).some(task =>
        task.squads.includes(squad.id) &&
        (task.status === 'moving' || task.status === 'engaging')
      );

    console.log(`[编组管理] 编组 ${squad.id}: 有成员在房间=${hasMemberInRoom}, 有活跃任务=${hasActiveAttackTask}`);

    // 如果编组中有成员在指定房间，或者编组状态为ready且没有其他任务，则可用
    const isAvailable = hasMemberInRoom || (!hasActiveAttackTask);

    if (isAvailable) {
      console.log(`[编组管理] 编组 ${squad.id} 可用，状态: ${squad.status}，成员数: ${aliveMembers.length}`);
    }

    return isAvailable;
  });

  console.log(`[编组管理] 房间 ${room.name} 找到 ${availableSquads.length} 个可用编组`);
  return availableSquads;
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
