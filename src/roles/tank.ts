// 坦克角色逻辑
export class RoleTank {
  static run(creep: Creep): void {
    // 检查生命值，如果太低则撤退
    if (creep.hits < creep.hitsMax * 0.3) {
      this.retreat(creep);
      return;
    }

    // 寻找敌人
    const target = this.findTarget(creep);

    if (target) {
      // 接近敌人，吸引火力
      this.engage(creep, target);
    } else {
      // 没有敌人时，保护重要建筑
      this.protect(creep);
    }
  }

  // 寻找目标
  private static findTarget(creep: Creep): Creep | Structure | null {
    // 优先攻击最近的敌人Creep
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      return creep.pos.findClosestByRange(hostiles);
    }

    // 其次攻击敌对建筑
    const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES);
    if (hostileStructures.length > 0) {
      return creep.pos.findClosestByRange(hostileStructures);
    }

    return null;
  }

  // 与敌人交战
  private static engage(creep: Creep, target: Creep | Structure): void {
    if (creep.pos.isNearTo(target)) {
      // 在攻击范围内，进行攻击
      const result = creep.attack(target);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      }
      creep.say('🛡️ 坦克');
    } else {
      // 移动到目标附近
      creep.moveTo(target);
    }
  }

  // 保护重要建筑
  private static protect(creep: Creep): void {
    // 寻找需要保护的建筑（spawn, storage, controller等）
    const importantStructures = creep.room.find(FIND_MY_STRUCTURES, {
      filter: (structure) =>
        structure.structureType === STRUCTURE_SPAWN ||
        structure.structureType === STRUCTURE_STORAGE ||
        structure.structureType === STRUCTURE_TERMINAL
    });

    if (importantStructures.length > 0) {
      // 移动到重要建筑附近进行保护
      const protectTarget = creep.pos.findClosestByRange(importantStructures);
      if (protectTarget && !creep.pos.isNearTo(protectTarget)) {
        creep.moveTo(protectTarget);
      }
    } else {
      // 没有重要建筑时，在房间中心巡逻
      this.patrol(creep);
    }
  }

  // 撤退逻辑
  private static retreat(creep: Creep): void {
    // 寻找安全的撤退点（靠近spawn）
    const safeSpots = creep.room.find(FIND_MY_SPAWNS);
    if (safeSpots.length > 0) {
      const safeSpot = creep.pos.findClosestByRange(safeSpots);
      if (safeSpot) {
        creep.moveTo(safeSpot);
        creep.say('🏃 撤退');
      }
    }
  }

  // 巡逻逻辑
  private static patrol(creep: Creep): void {
    // 在房间中心区域巡逻
    const centerX = 25;
    const centerY = 25;

    if (!creep.memory.patrolPoint) {
      creep.memory.patrolPoint = {
        x: centerX + (Math.random() - 0.5) * 10,
        y: centerY + (Math.random() - 0.5) * 10
      };
    }

    const patrolPos = new RoomPosition(
      creep.memory.patrolPoint.x,
      creep.memory.patrolPoint.y,
      creep.room.name
    );

    // 到达巡逻点后重新设置
    if (creep.pos.isNearTo(patrolPos)) {
      delete creep.memory.patrolPoint;
    } else {
      creep.moveTo(patrolPos);
    }
  }
}
