// 牧师/治疗者角色逻辑
export class RoleHealer {
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
    console.log(`[牧师${creep.name}] 🎉 已到达目标房间 ${targetRoom}！开始执行战斗逻辑`);
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
        visualizePathStyle: { stroke: '#ff00ff' },
        reusePath: 5
      });
    } else {
      // 距离队长在2格以内，原地等待
    }
  }

  // 执行战斗逻辑
  private static executeCombatLogic(creep: Creep): void {
    // 在目标房间中寻找需要治疗的友军
    const target = this.findHealTarget(creep);
    if (target) {
      this.heal(creep, target);
      creep.memory.working = true;
    } else {
      // 没有需要治疗的友军，跟随编组或等待
      creep.memory.working = false;
      this.followSquad(creep);
    }
  }

  // 寻找治疗目标
  private static findHealTarget(creep: Creep): Creep | null {
    // 优先治疗生命值最低的友军
    const allies = creep.room.find(FIND_MY_CREEPS, {
      filter: (ally) => ally.hits < ally.hitsMax
    });

    if (allies.length > 0) {
      // 按生命值百分比排序，优先治疗最受伤的
      allies.sort((a, b) => (a.hits / a.hitsMax) - (b.hits / b.hitsMax));
      return allies[0];
    }

    return null;
  }

  // 治疗目标
  private static heal(creep: Creep, target: Creep): void {
    const range = creep.pos.getRangeTo(target);

    if (range <= 3) {
      // 在治疗范围内，进行治疗
      const result = creep.heal(target);
      if (result === OK) {
        creep.say('💚 治疗');
      } else if (result === ERR_NOT_IN_RANGE) {
        // 如果不在范围内，移动到目标附近
        creep.moveTo(target);
      }
    } else {
      // 移动到治疗范围内
      creep.moveTo(target);
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

  // 跟随编组
  private static followSquad(creep: Creep): void {
    // 如果有战斗小组ID，尝试跟随小组
    if (creep.memory.squadId && Memory.combatSquads && Memory.combatSquads[creep.memory.squadId]) {
      const squad = Memory.combatSquads[creep.memory.squadId];

      // 跟随坦克或战士
      const followTarget = Game.creeps[squad.members.tank] || Game.creeps[squad.members.warrior];

      if (followTarget && followTarget.room.name === creep.room.name) {
        // 保持适当的跟随距离（2-3格）
        const distance = creep.pos.getRangeTo(followTarget);
        if (distance > 3) {
          creep.moveTo(followTarget, {
            visualizePathStyle: { stroke: '#ff00ff' }
          });
          // creep.say('👥 跟随');
        } else if (distance < 2) {
          // 太近了，稍微远离
          this.keepDistance(creep, followTarget);
        }
        return;
      }
    }

    // 没有跟随目标时，在安全位置等待
    this.waitInSafePosition(creep);
  }

  // 保持距离
  private static keepDistance(creep: Creep, target: Creep): void {
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
        creep.moveTo(newPos, {
          visualizePathStyle: { stroke: '#ff00ff' }
        });
      }
    }
  }

  // 在安全位置等待
  private static waitInSafePosition(creep: Creep): void {
    // 寻找房间中的安全位置（远离敌人）
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      // 有敌人时，移动到远离敌人的位置
      const closestHostile = creep.pos.findClosestByRange(hostiles);
      if (closestHostile) {
        const direction = this.getDirectionAwayFrom(creep.pos, closestHostile.pos);
        const safePos = new RoomPosition(
          creep.pos.x + direction.x * 3,
          creep.pos.y + direction.y * 3,
          creep.room.name
        );

        if (safePos.x >= 0 && safePos.x < 50 && safePos.y >= 0 && safePos.y < 50) {
          creep.moveTo(safePos, {
            visualizePathStyle: { stroke: '#ff00ff' }
          });
          creep.say('🛡️ 躲避');
        }
      }
    } else {
      // 没有敌人时，原地等待
      creep.say('⏳ 等待任务');
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
}
