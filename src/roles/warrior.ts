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

    // 第一步：检查是否到达目标房间
    if (creep.room.name !== targetRoom) {
      // 还没到达目标房间，继续移动
      console.log(`[战士${creep.name}] 还没到达目标房间 ${targetRoom}，当前在房间 ${creep.room.name}，继续移动`);
      this.moveToTargetRoom(creep, targetRoom);
      return;
    }

    // 第二步：已经到达目标房间，检查小队集结状态
    console.log(`[战士${creep.name}] 🎉 已到达目标房间 ${targetRoom}！检查小队集结状态`);

    if (this.checkSquadAssembly(creep)) {
      // 小队集结完成，开始执行战斗逻辑
      console.log(`[战士${creep.name}] 小队集结完成！开始执行战斗逻辑`);
      this.executeCombatLogic(creep);
    } else {
      // 等待其他队员集结
      console.log(`[战士${creep.name}] 等待其他队员集结...`);
      this.waitForAssembly(creep);
    }
  }

  // 检查小队集结状态
  private static checkSquadAssembly(creep: Creep): boolean {
    if (!creep.memory.squadId || !Memory.combatSquads || !Memory.combatSquads[creep.memory.squadId]) {
      console.log(`[战士${creep.name}] 没有战斗小组信息，无法检查集结状态`);
      return false;
    }

    const squad = Memory.combatSquads[creep.memory.squadId];
    const targetRoom = creep.memory.attackTarget;

    if (!targetRoom) return false;

    // 检查所有队员是否都在目标房间
    for (const [role, memberName] of Object.entries(squad.members)) {
      if (!memberName) continue;

      const member = Game.creeps[memberName];
      if (!member) {
        console.log(`[战士${creep.name}] 队员 ${memberName} 不存在`);
        continue;
      }

      if (member.room.name !== targetRoom) {
        console.log(`[战士${creep.name}] 队员 ${memberName} (${role}) 还没到达目标房间，当前在 ${member.room.name}`);
        return false;
      }
    }

    // 所有队员都在目标房间，集结完成
    console.log(`[战士${creep.name}] 🎯 所有队员都已到达目标房间，集结完成！`);
    return true;
  }

  // 等待集结
  private static waitForAssembly(creep: Creep): void {
    // 在房间中心附近等待，避免被敌人攻击
    const centerPos = new RoomPosition(25, 25, creep.room.name);

    if (creep.pos.getRangeTo(centerPos) > 5) {
      creep.moveTo(centerPos, {
        visualizePathStyle: { stroke: '#ffff00' },
        maxRooms: 1
      });
      creep.say('⏳ 等待集结');
    } else {
      creep.say('⏳ 等待集结');
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

  // 移动到目标房间
  private static moveToTargetRoom(creep: Creep, targetRoom: string): void {
    console.log(`[战士${creep.name}] 向目标房间 ${targetRoom} 移动，当前在房间 ${creep.room.name}`);

    // 直接移动到目标房间的中心位置
    const targetPos = new RoomPosition(25, 25, targetRoom);
    const moveResult = creep.moveTo(targetPos, {
      visualizePathStyle: { stroke: '#ff0000' }
    });

    if (moveResult === OK) {
      creep.say('🚀 向目标房间移动');
      console.log(`[战士${creep.name}] 成功设置移动到目标房间 ${targetRoom}`);
    } else {
      creep.say('❌ 移动失败');
      console.log(`[战士${creep.name}] 移动到目标房间失败: ${moveResult}`);
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
