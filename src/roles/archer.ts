// 弓箭手角色逻辑
export class RoleArcher {
  static run(creep: Creep): void {
    // 检查生命值，如果太低则撤退
    if (creep.hits < creep.hitsMax * 0.6) {
      this.retreat(creep);
      return;
    }

    // 寻找敌人
    const target = this.findTarget(creep);

    if (target) {
      // 远程攻击敌人
      this.rangedAttack(creep, target);
    } else {
      // 没有敌人时，移动到安全位置
      this.reposition(creep);
    }
  }

  // 寻找攻击目标
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

  // 远程攻击
  private static rangedAttack(creep: Creep, target: Creep | Structure): void {
    const range = creep.pos.getRangeTo(target);

    if (range <= 3) {
      // 在攻击范围内，进行远程攻击
      const result = creep.rangedAttack(target);
      if (result === OK) {
        creep.say('🏹 射击');
      }

      // 如果敌人太近，保持距离
      if (range <= 1) {
        this.keepDistance(creep, target);
      }
    } else if (range <= 10) {
      // 在移动范围内，移动到攻击位置
      creep.moveTo(target);
    } else {
      // 目标太远，移动到更近的位置
      this.moveToAttackPosition(creep, target);
    }
  }

  // 保持距离
  private static keepDistance(creep: Creep, target: Creep | Structure): void {
    // 计算远离目标的方向
    const direction = this.getDirectionAwayFrom(creep.pos, target.pos);
    const newPos = new RoomPosition(
      creep.pos.x + direction.x,
      creep.pos.y + direction.y,
      creep.room.name
    );

    // 检查新位置是否有效
    if (newPos.x >= 0 && newPos.x < 50 && newPos.y >= 0 && newPos.y < 50) {
      const terrain = creep.room.lookForAt(LOOK_TERRAIN, newPos)[0];
      if (terrain !== 'wall') {
        creep.moveTo(newPos);
      }
    }
  }

  // 移动到攻击位置
  private static moveToAttackPosition(creep: Creep, target: Creep | Structure): void {
    // 计算最佳攻击位置（距离目标3格）
    const targetPos = target.pos;
    const direction = this.getDirectionTo(creep.pos, targetPos);

    // 尝试找到距离目标3格的位置
    for (let distance = 3; distance <= 5; distance++) {
      const attackPos = new RoomPosition(
        targetPos.x + direction.x * distance,
        targetPos.y + direction.y * distance,
        creep.room.name
      );

      if (attackPos.x >= 0 && attackPos.x < 50 && attackPos.y >= 0 && attackPos.y < 50) {
        const terrain = creep.room.lookForAt(LOOK_TERRAIN, attackPos)[0];
        if (terrain !== 'wall') {
          creep.moveTo(attackPos);
          return;
        }
      }
    }

    // 如果找不到好的位置，直接移动到目标附近
    creep.moveTo(target);
  }

  // 重新定位
  private static reposition(creep: Creep): void {
    // 移动到房间中心的安全位置
    const centerX = 25;
    const centerY = 25;

    if (!creep.memory.patrolPoint) {
      creep.memory.patrolPoint = {
        x: centerX + (Math.random() - 0.5) * 8,
        y: centerY + (Math.random() - 0.5) * 8
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

  // 获取远离目标的方向
  private static getDirectionAwayFrom(from: RoomPosition, to: RoomPosition): { x: number, y: number } {
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    return {
      x: Math.sign(dx) || (Math.random() > 0.5 ? 1 : -1),
      y: Math.sign(dy) || (Math.random() > 0.5 ? 1 : -1)
    };
  }

  // 获取朝向目标的方向
  private static getDirectionTo(from: RoomPosition, to: RoomPosition): { x: number, y: number } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return {
      x: Math.sign(dx) || 0,
      y: Math.sign(dy) || 0
    };
  }
}
