// 坦克角色逻辑
export class RoleTank {
  public static run(creep: Creep): void {
    // 检查是否有攻击任务
    if (creep.memory.attackTaskId && creep.memory.attackTarget) {
      this.handleAttackTask(creep);
      return;
    }

    // 检查是否有保护任务
    if ((creep.memory as any).protectTaskId) {
      this.protect(creep);
      return;
    }

    // 默认巡逻
    this.patrol(creep);
  }

  // 处理攻击任务
  private static handleAttackTask(creep: Creep): void {
    const targetRoom = creep.memory.attackTarget;
    if (!targetRoom) return;

    // 第一步：检查是否到达目标房间,如果没到达，则移动到目标房间
    if (!Game.rooms[targetRoom]) {
      creep.moveTo(new RoomPosition(25, 25, targetRoom))
    } else {
      // 第二步：已经到达目标房间，检查小队集结状态
      console.log(`[坦克${creep.name}] 🎉 已到达目标房间 ${targetRoom}！检查小队集结状态`);
    }

    if (this.checkSquadAssembly(creep)) {
      // 小队集结完成，开始执行战斗逻辑
      console.log(`[坦克${creep.name}] 小队集结完成！开始执行战斗逻辑`);
      this.executeCombatLogic(creep);
    } else {
      // 等待其他队员集结
      console.log(`[坦克${creep.name}] 等待其他队员集结...`);
      this.waitForAssembly(creep);
    }
  }

  // 检查小队集结状态
  private static checkSquadAssembly(creep: Creep): boolean {
    if (!creep.memory.squadId || !Memory.combatSquads || !Memory.combatSquads[creep.memory.squadId]) {
      console.log(`[坦克${creep.name}] 没有战斗小组信息，无法检查集结状态`);
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
        console.log(`[坦克${creep.name}] 队员 ${memberName} 不存在`);
        continue;
      }

      if (member.room.name !== targetRoom) {
        console.log(`[坦克${creep.name}] 队员 ${memberName} (${role}) 还没到达目标房间，当前在 ${member.room.name}`);
        return false;
      }
    }

    // 所有队员都在目标房间，集结完成
    console.log(`[坦克${creep.name}] 🎯 所有队员都已到达目标房间，集结完成！`);

    // 通知所有队员集结完成
    this.notifyAssemblyComplete(creep, squad);

    return true;
  }

  // 通知集结完成
  private static notifyAssemblyComplete(creep: Creep, squad: { members: Record<string, string> }): void {
    for (const [role, memberName] of Object.entries(squad.members)) {
      if (!memberName) continue;

      const member = Game.creeps[memberName];
      if (member && member.room.name === creep.room.name) {
        member.say("集结完成!");
        console.log(`[坦克${creep.name}] 通知队员 ${memberName} (${role}) 集结完成`);
      }
    }
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
    // 检查是否在边界位置
    if (this.isAtRoomBorder(creep)) {
      console.log(`[坦克${creep.name}] 在目标房间但仍在边界，向房间中心移动`);
      this.moveToRoomCenter(creep);
      return;
    }

    // 已经在目标房间的安全位置，开始搜寻敌人
    console.log(`[坦克${creep.name}] 在目标房间安全位置，开始搜寻敌人`);
    this.findAndAttackEnemies(creep);
  }

  // // 移动到目标房间
  // private static moveToTargetRoom(creep: Creep, targetRoom: string): void {
  //   console.log(`[坦克${creep.name}] 向目标房间 ${targetRoom} 移动，当前在房间 ${creep.room.name}`);

  //   if (!targetRoom) {
  //     creep.moveTo(new RoomPosition(25, 25, targetRoom))
  //   }
  //   else {
  //     //执行等待集合的逻辑
  //     this.waitForAssembly(creep);
  //   }
  // }

  // 检查是否在房间边界
  private static isAtRoomBorder(creep: Creep): boolean {
    // 检查是否在房间边缘2格范围内
    const borderDistance = 2;
    return creep.pos.x <= borderDistance ||
      creep.pos.x >= 50 - borderDistance ||
      creep.pos.y <= borderDistance ||
      creep.pos.y >= 50 - borderDistance;
  }

  // 移动到房间中心
  private static moveToRoomCenter(creep: Creep): void {
    const centerPos = new RoomPosition(25, 25, creep.room.name);
    creep.moveTo(centerPos, {
      visualizePathStyle: { stroke: '#00ff00' },
      maxRooms: 1
    });
    creep.say('🎯 向中心移动');
  }

  // 寻找并攻击敌人
  private static findAndAttackEnemies(creep: Creep): void {
    // 寻找敌人
    const enemies = creep.room.find(FIND_HOSTILE_CREEPS);

    if (enemies.length === 0) {
      creep.say('🔍 无敌人');
      return;
    }

    // 找到最近的敌人
    const closestEnemy = creep.pos.findClosestByRange(enemies);
    if (!closestEnemy) return;

    // 输出敌人位置
    console.log(`[坦克${creep.name}] 发现敌人: ${closestEnemy.name} 位置: ${closestEnemy.pos.x},${closestEnemy.pos.y}`);

    // 移动到敌人附近进行攻击
    if (creep.pos.isNearTo(closestEnemy)) {
      creep.attack(closestEnemy);
      creep.say('⚔️ 攻击');
    } else {
      creep.moveTo(closestEnemy);
      creep.say('🎯 追击');
    }
  }

  // 保护重要建筑
  private static protect(creep: Creep): void {
    // 寻找需要保护的建筑（spawn, storage, controller等）
    const importantStructures = creep.room.find(FIND_MY_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_STORAGE ||
          structure.structureType === STRUCTURE_TERMINAL ||
          structure.structureType === STRUCTURE_LAB;
      }
    });

    if (importantStructures.length > 0) {
      // 找到最近的建筑进行保护
      const closestStructure = creep.pos.findClosestByRange(importantStructures);
      if (closestStructure) {
        creep.moveTo(closestStructure);
        creep.say('🛡️ 保护');
      }
    } else {
      // 没有重要建筑时，在房间中心巡逻
      this.patrol(creep);
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
