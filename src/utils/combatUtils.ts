import { COMBAT_BODY_PARTS, COMBAT_ROLES, BODY_PART_COSTS } from '../config/combatConfig';

// 计算身体部件的能量消耗
export function getCombatBodyCost(bodyParts: BodyPartConstant[]): number {
  return bodyParts.reduce((total, part) => {
    const cost = BODY_PART_COSTS[part as keyof typeof BODY_PART_COSTS];
    return total + (cost || 0);
  }, 0);
}

// 生成战斗兵种的最优身体部件配置
export function getOptimalCombatBodyParts(role: string, availableEnergy: number): BodyPartConstant[] {
  const roleConfig = COMBAT_BODY_PARTS[role as keyof typeof COMBAT_BODY_PARTS];
  if (!roleConfig) return [];

  const { base, cost } = roleConfig;

  // 如果基础配置都买不起，返回空数组
  if (cost > availableEnergy) return [];

  // 计算可以添加多少组基础配置
  const maxGroups = Math.floor(availableEnergy / cost);

  // 最多添加3组，避免过度复杂
  const groupsToAdd = Math.min(maxGroups, 3);

  let finalParts: BodyPartConstant[] = [];

  // 添加基础配置
  for (let i = 0; i < groupsToAdd; i++) {
    finalParts = finalParts.concat(base);
  }

  // 按照指定顺序排序：TOUGH > MOVE > ATTACK/RANGED_ATTACK/HEAL
  return sortCombatBodyParts(finalParts);
}

// 排序战斗身体部件（TOUGH在前，MOVE其次，攻击部件最后）
export function sortCombatBodyParts(bodyParts: BodyPartConstant[]): BodyPartConstant[] {
  const priorityOrder: Record<BodyPartConstant, number> = {
    [TOUGH]: 1,
    [MOVE]: 2,
    [ATTACK]: 3,
    [RANGED_ATTACK]: 3,
    [HEAL]: 3,
    [WORK]: 4,
    [CARRY]: 4,
    [CLAIM]: 4
  };

  return bodyParts.sort((a, b) => {
    const priorityA = priorityOrder[a] || 5;
    const priorityB = priorityOrder[b] || 5;
    return priorityA - priorityB;
  });
}

// 检查是否为战斗角色
export function isCombatRole(role: string): boolean {
  return Object.values(COMBAT_ROLES).includes(role as any);
}

// 获取战斗角色的优先级（用于生产排序）
export function getCombatRolePriority(role: string): number {
  const priorities = {
    [COMBAT_ROLES.TANK]: 1,      // 坦克优先级最高
    [COMBAT_ROLES.WARRIOR]: 2,   // 战士其次
    [COMBAT_ROLES.ARCHER]: 3,    // 弓箭手
    [COMBAT_ROLES.HEALER]: 4     // 牧师最后
  };

  return priorities[role as keyof typeof priorities] || 999;
}

// 统计房间内的战斗单位
export function countCombatCreeps(room: Room): Record<string, number> {
  const combatCounts = {
    [COMBAT_ROLES.WARRIOR]: 0,
    [COMBAT_ROLES.TANK]: 0,
    [COMBAT_ROLES.HEALER]: 0,
    [COMBAT_ROLES.ARCHER]: 0
  };

  const roomCreeps = room.find(FIND_MY_CREEPS);
  for (const creep of roomCreeps) {
    if (isCombatRole(creep.memory.role)) {
      combatCounts[creep.memory.role as keyof typeof combatCounts]++;
    }
  }

  return combatCounts;
}

// 检查是否已建立完整的战斗小组
export function hasCompleteCombatSquad(combatCounts: Record<string, number>): boolean {
  return Object.values(combatCounts).every(count => count > 0);
}
