// 坦克角色逻辑 - 既是前排也是队长
export class RoleTank {
  public static run(creep: Creep): void {
    // 测试指令：检查是否有跨房间移动任务
    if (creep.memory.testMoveToRoom) {
      this.handleTestMoveTask(creep);
      return;
    }

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

    // 默认巡逻（保持现有逻辑）
    this.patrol(creep);
  }

  // 处理测试移动任务
  private static handleTestMoveTask(creep: Creep): void {
    const targetRoom = creep.memory.testMoveToRoom!;
    console.log(`[测试坦克${creep.name}] 开始移动到目标房间: ${targetRoom}`);

    // 检查是否在目标房间
    if (creep.room.name === targetRoom) {
      // 已经到达目标房间
      console.log(`[测试坦克${creep.name}] 🎉 已到达目标房间 ${targetRoom}！`);
      creep.say('🎯 已到达');

      // 清除测试任务，开始巡逻
      delete creep.memory.testMoveToRoom;
      this.patrol(creep);
      return;
    }

    // 还没到达目标房间，开始跨房间移动
    console.log(`[测试坦克${creep.name}] 🚀 开始跨房间移动到 ${targetRoom}`);
    creep.say('🚀 跨房间移动');

    // 使用moveTo直接移动到目标房间
    creep.moveTo(new RoomPosition(25, 25, targetRoom), {
      visualizePathStyle: { stroke: '#ff0000' },
      reusePath: 5
    });
  }

  // 处理攻击任务
  private static handleAttackTask(creep: Creep): void {
    const targetRoom = Game.rooms[creep.memory.attackTarget as string];
    console.log(creep.room.name)
    // 检查是否在目标房间
    if (!targetRoom) {
      // 还没到达目标房间，一直走
      creep.moveTo(new RoomPosition(25, 25, creep.memory.attackTarget as string), {
        visualizePathStyle: { stroke: '#ff0000' }
      });
      creep.say('🚀 向目标移动');
    } else {
      // 已经到达目标房间，开始执行战斗逻辑
      console.log(`[坦克队长${creep.name}] 🎉 已到达目标房间 ${targetRoom.name}！开始执行战斗逻辑`);
      if (targetRoom.controller) {
        creep.moveTo(targetRoom.controller.pos);
      } else {
        // 如果没有controller，默认移动到房间中央
        creep.moveTo(new RoomPosition(25, 25, targetRoom.name));
      }
    }
  }
      // this.executeCombatLogic(creep);

  // // 寻找出口路径
  // private static findExitPath(creep: Creep, targetRoom: string): void {
  //   // 使用 findExitTo 方法寻找前往目标房间的路径
  //   const exitDirection = creep.room.findExitTo(targetRoom);

  //   if (exitDirection === ERR_NO_PATH || exitDirection === ERR_INVALID_ARGS) {
  //     console.log(`[坦克队长${creep.name}] 无法找到前往房间 ${targetRoom} 的路径`);
  //     creep.say('❌ 无路径');
  //     return;
  //   }

  //   // 找到出口位置
  //   const exits = creep.pos.findInRange(FIND_EXIT, 1);
  //   if (exits.length > 0) {
  //     const exit = exits[0];
  //     const pathLength = creep.pos.getRangeTo(exit);

  //     // 当路径长度=2时，调用跨房间移动
  //     if (pathLength <= 2) {
  //       this.crossRoomMove(creep, targetRoom);
  //       return;
  //     }

  //     creep.moveTo(exit, {
  //       visualizePathStyle: { stroke: '#ff0000' }
  //     });
  //     creep.say('🚪 寻找出口');
  //   } else {
  //     // 如果找不到出口，直接向目标房间移动
  //     creep.moveTo(new RoomPosition(25, 25, targetRoom), {
  //       visualizePathStyle: { stroke: '#ff0000' }
  //     });
  //     creep.say('🚀 向目标移动');
  //   }
  // }

  // 跨房间移动
  // private static crossRoomMove(creep: Creep, targetRoom: string): void {
  //   // 检查目标房间是否存在
  //   const room = Game.rooms[targetRoom];

  //   if (!room) {
  //     // 如果该房间不存在就先往房间走
  //     creep.moveTo(new RoomPosition(25, 25, targetRoom), {
  //       visualizePathStyle: { stroke: '#ff0000' }
  //     });
  //     creep.say('🚀 跨房间移动');
  //     console.log(`[坦克队长${creep.name}] 目标房间 ${targetRoom} 不存在，开始跨房间移动`);
  //   } else {
  //     // 如果房间存在了就说明已经进入了该房间
  //     console.log(`[坦克队长${creep.name}] 已进入目标房间 ${targetRoom}，开始搜寻敌人`);
  //     creep.say('🎯 已到达');
  //     // 开始执行战斗逻辑
  //     this.executeCombatLogic(creep);
  //   }
  // }

  // 执行战斗逻辑
  // private static executeCombatLogic(creep: Creep): void {
  //   // 检查是否在边界位置
  //   if (this.isAtRoomBorder(creep)) {
  //     console.log(`[坦克队长${creep.name}] 在目标房间但仍在边界，向房间中心移动`);
  //     this.moveToRoomCenter(creep);
  //     return;
  //   }

    // 已经在目标房间的安全位置，开始搜寻敌人
  //   console.log(`[坦克队长${creep.name}] 在目标房间安全位置，开始搜寻敌人`);
  //   this.findAndAttackEnemies(creep);
  // }

  // // 检查是否在房间边界
  // private static isAtRoomBorder(creep: Creep): boolean {
  //   // 检查是否在房间边缘2格范围内
  //   const borderDistance = 2;
  //   return creep.pos.x <= borderDistance ||
  //     creep.pos.x >= 50 - borderDistance ||
  //     creep.pos.y <= borderDistance ||
  //     creep.pos.y >= 50 - borderDistance;
  // }

  // // 移动到房间中心
  // private static moveToRoomCenter(creep: Creep): void {
  //   const centerPos = new RoomPosition(25, 25, creep.room.name);
  //   creep.moveTo(centerPos, {
  //     visualizePathStyle: { stroke: '#00ff00' },
  //     maxRooms: 1
  //   });
  //   creep.say('🎯 向中心移动');
  // }

  // 寻找并攻击敌人
  // private static findAndAttackEnemies(creep: Creep): void {
  //   // 寻找敌人
  //   const enemies = creep.room.find(FIND_HOSTILE_CREEPS);

  //   if (enemies.length === 0) {
  //     creep.say('🔍 无敌人');
  //     return;
  //   }

  //   // 找到最近的敌人
  //   const closestEnemy = creep.pos.findClosestByRange(enemies);
  //   if (!closestEnemy) return;

  //   // 输出敌人位置
  //   console.log(`[坦克队长${creep.name}] 发现敌人: ${closestEnemy.name} 位置: ${closestEnemy.pos.x},${closestEnemy.pos.y}`);

  //   // 移动到敌人附近进行攻击
  //   if (creep.pos.isNearTo(closestEnemy)) {
  //     creep.attack(closestEnemy);
  //     creep.say('⚔️ 攻击');
  //   } else {
  //     creep.moveTo(closestEnemy);
  //     creep.say('🎯 追击');
  //   }
  // }

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
