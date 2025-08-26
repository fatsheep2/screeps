import { BODY_PART_COSTS } from '../config/creepConfig';

// 计算身体部件的能量消耗
export function getBodyCost(bodyParts: BodyPartConstant[]): number {
  return bodyParts.reduce((total, part) => total + (BODY_PART_COSTS[part] || 0), 0);
}

// 获取错误信息的友好描述
export function getErrorMessage(result: number): string {
  const errorMessages: { [key: number]: string } = {
    [ERR_NOT_OWNER]: '不是房间的所有者',
    [ERR_NAME_EXISTS]: '名称已存在',
    [ERR_BUSY]: 'Spawn 正忙',
    [ERR_NOT_ENOUGH_ENERGY]: '能量不足',
    [ERR_INVALID_ARGS]: '参数无效',
    [ERR_RCL_NOT_ENOUGH]: '房间控制器等级不足'
  };

  return errorMessages[result] || `未知错误 (${result})`;
}

// 检查房间是否已经建立了基础兵种
export function hasBasicCreeps(creepCounts: Record<string, number>): boolean {
  return creepCounts.carrier > 0 &&
         creepCounts.staticHarvester > 0 &&
         creepCounts.upgrader > 0 &&
         creepCounts.builder > 0;
}

// 统计房间内的 Creep
export function countRoomCreeps(room: Room): Record<string, number> {
  const creepCounts = {
    harvester: 0,
    staticHarvester: 0,
    upgrader: 0,
    builder: 0,
    carrier: 0
  };

  const roomCreeps = room.find(FIND_MY_CREEPS);
  for (const creep of roomCreeps) {
    const role = creep.memory.role;
    if (role in creepCounts) {
      creepCounts[role as keyof typeof creepCounts]++;
    }
  }

  return creepCounts;
}
