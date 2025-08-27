// 弓箭手角色逻辑
export class RoleArcher {
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

    // 平时跟随队长移动，保持队形
    this.followLeader(creep);
  }

  // 处理攻击任务
  private static handleAttackTask(creep: Creep): void {
    const targetRoom = creep.memory.attackTarget;
    if (!targetRoom) return;

    // 检查是否到达目标房间
    if (creep.room.name !== targetRoom) {
      // 还没到达目标房间，跟随队长移动
      this.followLeader(creep);
      return;
    }

    // 已经到达目标房间，开始执行战斗逻辑
    console.log(`[弓箭手${creep.name}] 🎉 已到达目标房间 ${targetRoom}！开始执行战斗逻辑`);
    this.executeCombatLogic(creep);
  }

  // 跟随队长移动
  private static followLeader(creep: Creep): void {
    if (!creep.memory.squadId || !Memory.combatSquads) {
      creep.say('❌ 无小队');
      return;
    }

    const squad = Memory.combatSquads[creep.memory.squadId];
    if (!squad) {
      creep.say('❌ 小队不存在');
      return;
    }

    // 移除集合标志检查，无条件跟随队长
    // 获取队长（坦克）
    const leaderName = squad.members.tank;
    if (!leaderName) {
      creep.say('❌ 无队长');
      return;
    }

    const leader = Game.creeps[leaderName];
    if (!leader) {
      creep.say('❌ 队长不存在');
      return;
    }

    // 检查与队长的距离
    const distanceToLeader = creep.pos.getRangeTo(leader);

    if (distanceToLeader > 2) {
      // 距离队长超过2格，移动到队长附近
      creep.moveTo(leader, {
        visualizePathStyle: { stroke: '#00ff00' },
        reusePath: 5
      });
    } else {
      // 距离队长在2格以内，原地等待
    }
  }

  // 执行战斗逻辑
  private static executeCombatLogic(creep: Creep): void {
    // 在目标房间中寻找敌人
    const target = this.findTarget(creep);
    if (target) {
      this.rangedAttack(creep, target);
      creep.memory.working = true;
    } else {
      // 没有敌人，等待或搜索
      creep.memory.working = false;
      this.searchForEnemies(creep);
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

    // 没有发现敌人，原地等待
    creep.say('⏳ 等待敌人');
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
