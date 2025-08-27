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
    console.log(`[战士${creep.name}] 🎉 已到达目标房间 ${targetRoom}！开始执行战斗逻辑`);
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
        visualizePathStyle: { stroke: '#ff0000' },
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
      this.attack(creep, target);
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
}
