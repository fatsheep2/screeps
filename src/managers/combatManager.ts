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

  return Object.values(Memory.combatSquads).filter(squad => {
    // 检查小组成员是否都在这个房间
    return Object.values(squad.members).every(memberName => {
      const creep = Game.creeps[memberName];
      return creep && creep.room.name === room.name;
    });
  });
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
