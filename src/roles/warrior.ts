// 近战战士角色逻辑
export class RoleWarrior {
  static run(creep: Creep): void {
    // 检查是否有攻击任务
    if (creep.memory.attackTaskId && creep.memory.attackTarget) {
      this.handleAttackTask(creep);
      return;
    }

    // 检查生命值，如果太低则撤退
    if (creep.hits < creep.hitsMax * 0.5) {
      this.retreat(creep);
      return;
    }

    // 寻找敌人
    const target = this.findTarget(creep);

    if (target) {
      // 攻击敌人
      this.attack(creep, target);
    } else {
      // 没有敌人时，移动到指定位置或巡逻
      this.patrol(creep);
    }
  }

  // 处理攻击任务
  private static handleAttackTask(creep: Creep): void {
    const targetRoom = creep.memory.attackTarget;
    if (!targetRoom) return;

    // 如果不在目标房间，移动到目标房间
    if (creep.room.name !== targetRoom) {
      this.moveToTargetRoom(creep, targetRoom);
      return;
    }

    // 在目标房间中寻找敌人
    const target = this.findTarget(creep);
    if (target) {
      this.attack(creep, target);
      creep.memory.working = true;
    } else {
      // 没有敌人，等待或搜索
      creep.memory.working = false;
      this.searchForEnemies(creep);
    }
  }

  // 移动到目标房间
  private static moveToTargetRoom(creep: Creep, targetRoom: string): void {
    // 使用 exit 移动到目标房间
    const exits = creep.room.findExitTo(targetRoom);
    if (exits === ERR_NO_PATH) {
      console.log(`战士 ${creep.name} 无法找到到房间 ${targetRoom} 的路径`);
      return;
    }

    if (exits === ERR_INVALID_ARGS) {
      console.log(`战士 ${creep.name} 目标房间 ${targetRoom} 无效`);
      return;
    }

    // 移动到出口
    const exit = creep.pos.findClosestByRange(exits);
    if (exit) {
      creep.moveTo(exit);
      creep.say('🚶 移动');
    }
  }

  // 搜索敌人
  private static searchForEnemies(creep: Creep): void {
    // 在房间中搜索敌人
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      creep.say('🎯 发现敌人');
      return;
    }

    // 搜索敌对建筑
    const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES);
    if (hostileStructures.length > 0) {
      creep.say('🏗️ 发现建筑');
      return;
    }

    // 没有发现敌人，在房间中巡逻
    this.patrol(creep);
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

  // 攻击目标
  private static attack(creep: Creep, target: Creep | Structure): void {
    if (creep.pos.isNearTo(target)) {
      // 在攻击范围内，进行攻击
      const result = creep.attack(target);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      }
    } else {
      // 移动到目标附近
      creep.moveTo(target);
    }
  }

  // 撤退逻辑
  private static retreat(creep: Creep): void {
    // 如果有攻击任务，返回源房间
    if (creep.memory.attackTaskId) {
      this.retreatFromAttack(creep);
      return;
    }

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

  // 从攻击任务撤退
  private static retreatFromAttack(creep: Creep): void {
    // 寻找源房间的出口
    const sourceRoom = creep.memory.room;
    if (sourceRoom && creep.room.name !== sourceRoom) {
      const exits = creep.room.findExitTo(sourceRoom);
      if (exits !== ERR_NO_PATH && exits !== ERR_INVALID_ARGS) {
        const exit = creep.pos.findClosestByRange(exits);
        if (exit) {
          creep.moveTo(exit);
          creep.say('🏃 撤退');
        }
      }
    }
  }

  // 巡逻逻辑
  private static patrol(creep: Creep): void {
    // 如果没有指定巡逻点，随机移动
    if (!creep.memory.patrolPoint) {
      creep.memory.patrolPoint = {
        x: Math.floor(Math.random() * 50),
        y: Math.floor(Math.random() * 50)
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
