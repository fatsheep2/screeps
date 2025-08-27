import { ROLE_LIMITS, BASE_BODY_PARTS, BODY_EXTENSIONS } from '../config/creepConfig';
import { getBodyCost } from '../utils/creepUtils';

// 尝试生产新 Creep
export function spawnCreeps(room: Room, creepCounts: Record<string, number>, hasBasic: boolean): void {
  const spawns = room.find(FIND_MY_SPAWNS);
  const availableSpawn = spawns.find(spawn => !spawn.spawning);

  if (!availableSpawn) {
    return;
  }

  // 检查房间能量状态
  const roomEnergy = room.energyAvailable;

  // 获取房间的采矿点信息
  const miningSpots = (Memory.rooms[room.name] as any)?.miningSpots || [];
  const miningSpotsCount = miningSpots.length;

  const dynamicRoleLimits = {
    ...ROLE_LIMITS,
    staticHarvester: miningSpotsCount // 根据采矿点数量动态调整静态矿工数量
  };

  // 根据基础兵种状态调整生产策略
  let priorities: string[];
  if (!hasBasic) {
    // 还没有建立基础兵种，优先生产缺失的
    priorities = getSpawnPriorities(room, creepCounts);
  } else {
    // 已建立基础兵种，优先补满矿工，然后是其他工种
    priorities = getAdvancedSpawnPriorities(room, creepCounts, roomEnergy, miningSpotsCount);
  }

  for (const role of priorities) {
    if (creepCounts[role] < dynamicRoleLimits[role as keyof typeof dynamicRoleLimits]) {
      // 根据可用能量选择身体部件
      const bodyParts = getOptimalBodyParts(role, roomEnergy, creepCounts);

      if (bodyParts.length === 0) {
        continue;
      }

      const name = `${role}_${Game.time}_${Math.floor(Math.random() * 1000)}`;

      const result = availableSpawn.spawnCreep(bodyParts, name, {
        memory: {
          role: role,
          room: room.name,
          working: false
        }
      });

      if (result === OK) {
        return;
      } else {
        // 如果是能量不足，尝试下一个角色
        if (result === ERR_NOT_ENOUGH_ENERGY) {
          continue;
        }
        // 其他错误则停止尝试
        break;
      }
    }
  }
}

// 获取基础工种优先级（确保每个工种至少有一个）
function getSpawnPriorities(_room: Room, creepCounts: Record<string, number>): string[] {
  const priorities: string[] = [];

  // 搬运工优先级最高，确保至少有一个
  if (creepCounts.carrier === 0) {
    priorities.push('carrier');
  }

  // 然后确保其他基础工种至少有一个
  if (creepCounts.staticHarvester === 0) {
    priorities.push('staticHarvester');
  }

  if (creepCounts.upgrader === 0) {
    priorities.push('upgrader');
  }

  if (creepCounts.builder === 0) {
    priorities.push('builder');
  }

  return priorities;
}

// 获取高级工种优先级（在基础工种齐全后的扩展）
function getAdvancedSpawnPriorities(_room: Room, creepCounts: Record<string, number>, _roomEnergy: number, miningSpotsCount: number): string[] {
  const priorities: string[] = [];

  // 搬运工优先级最高，确保有足够的搬运工
  if (creepCounts.carrier < 2) {
    priorities.push('carrier');
  }

  // 然后优先补满静态矿工
  if (miningSpotsCount > 0 && creepCounts.staticHarvester < miningSpotsCount) {
    priorities.push('staticHarvester');
  }

  // 最后是其他工种
  if (creepCounts.upgrader < ROLE_LIMITS.upgrader) {
    priorities.push('upgrader');
  }

  if (creepCounts.builder < ROLE_LIMITS.builder) {
    priorities.push('builder');
  }

  return priorities;
}

// 根据可用能量和工种数量获取最优身体部件
function getOptimalBodyParts(role: string, availableEnergy: number, creepCounts: Record<string, number>): BodyPartConstant[] {
  // 基础配置
  const baseParts = BASE_BODY_PARTS[role as keyof typeof BASE_BODY_PARTS];
  if (!baseParts) return [];

  // 计算基础配置的能量消耗
  const baseCost = getBodyCost(baseParts);

  // 如果基础配置都买不起，返回空数组
  if (baseCost > availableEnergy) {
    return [];
  }

  // 根据角色类型使用不同的升级策略
  if (role === 'carrier') {
    // 搬运工：按照 MOVE:CARRY 1:2 的比例升级
    return getCarrierOptimalParts(availableEnergy, baseParts);
  } else if (role === 'staticHarvester') {
    // 静态矿工：按照 WORK 的倍数升级
    return getStaticHarvesterOptimalParts(availableEnergy, baseParts);
  } else {
    // 其他角色：使用原来的逻辑
    return getStandardOptimalParts(availableEnergy, baseParts, creepCounts, role);
  }
}

// 搬运工的最优身体部件配置（按照 MOVE:CARRY 1:2 的比例）
function getCarrierOptimalParts(availableEnergy: number, baseParts: BodyPartConstant[]): BodyPartConstant[] {
  let finalParts = [...baseParts];

  // 搬运工基础配置：4 CARRY + 2 MOVE = 300 能量
  // 可以添加更多 CARRY 和 MOVE，保持 1:2 比例
  const additionalParts = [CARRY, CARRY, MOVE]; // 150 能量

  // 计算可以添加多少组额外部件
  const additionalCost = getBodyCost(additionalParts);
  const maxGroups = Math.floor((availableEnergy - getBodyCost(baseParts)) / additionalCost);

  // 最多添加 3 组，避免过度复杂
  const groupsToAdd = Math.min(maxGroups, 3);

  for (let i = 0; i < groupsToAdd; i++) {
    finalParts = finalParts.concat(additionalParts);
  }

  return finalParts;
}

// 静态矿工的最优身体部件配置（按照 WORK 的倍数）
function getStaticHarvesterOptimalParts(availableEnergy: number, baseParts: BodyPartConstant[]): BodyPartConstant[] {
  let finalParts = [...baseParts];

  // 静态矿工基础配置：3 WORK = 300 能量
  // 可以添加更多 WORK，每次 100 能量
  const workCost = 100;
  const baseCost = getBodyCost(baseParts);
  const remainingEnergy = availableEnergy - baseCost;

  // 计算可以添加多少个 WORK
  const additionalWork = Math.floor(remainingEnergy / workCost);

  // 最多添加 5 个额外的 WORK，避免过度复杂
  const workToAdd = Math.min(additionalWork, 5);

  for (let i = 0; i < workToAdd; i++) {
    finalParts.push(WORK);
  }

  return finalParts;
}

// 标准角色的最优身体部件配置（原来的逻辑）
function getStandardOptimalParts(availableEnergy: number, baseParts: BodyPartConstant[], creepCounts: Record<string, number>, role: string): BodyPartConstant[] {
  // 计算基础配置的能量消耗
  const baseCost = getBodyCost(baseParts);

  // 检查每个工种的数量，决定是否需要扩展
  let extensionLevel = 0;

  // 如果每个工种都大于1，开始扩展
  if (creepCounts.carrier > 1 &&
      creepCounts.staticHarvester > 1 &&
      creepCounts.upgrader > 1 &&
      creepCounts.builder > 1) {

    // 计算可以扩展几次
    const extensionParts = BODY_EXTENSIONS[role as keyof typeof BODY_EXTENSIONS];
    if (extensionParts) {
      const extensionCost = getBodyCost(extensionParts);

      // 计算可以扩展的次数
      const maxExtensions = Math.floor((availableEnergy - baseCost) / extensionCost);
      extensionLevel = Math.min(maxExtensions, 2); // 最多扩展2次，避免过度复杂
    }
  }

  // 构建最终的身体部件配置
  let finalParts = [...baseParts];

  // 添加扩展部件
  const extensionParts = BODY_EXTENSIONS[role as keyof typeof BODY_EXTENSIONS];
  if (extensionParts && extensionLevel > 0) {
    for (let i = 0; i < extensionLevel; i++) {
      finalParts = finalParts.concat(extensionParts);
    }
  }

  // 验证最终配置是否在能量范围内
  const finalCost = getBodyCost(finalParts);
  if (finalCost <= availableEnergy) {
    return finalParts;
  } else {
    // 如果超出能量范围，回退到基础配置
    return baseParts;
  }
}
