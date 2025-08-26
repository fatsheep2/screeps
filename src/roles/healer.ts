// 牧师/治疗者角色逻辑
export class RoleHealer {
  static run(creep: Creep): void {
    // 检查生命值，如果太低则撤退
    if (creep.hits < creep.hitsMax * 0.7) {
      this.retreat(creep);
      return;
    }

    // 寻找需要治疗的友军
    const target = this.findHealTarget(creep);

    if (target) {
      // 治疗友军
      this.heal(creep, target);
    } else {
      // 没有需要治疗的目标时，跟随战斗小组或巡逻
      this.followOrPatrol(creep);
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

  // 跟随战斗小组或巡逻
  private static followOrPatrol(creep: Creep): void {
    // 如果有战斗小组ID，尝试跟随小组
    if (creep.memory.squadId && Memory.combatSquads && Memory.combatSquads[creep.memory.squadId]) {
      const squad = Memory.combatSquads[creep.memory.squadId];

      // 跟随坦克或战士
      const followTarget = Game.creeps[squad.members.tank] || Game.creeps[squad.members.warrior];

      if (followTarget && followTarget.room.name === creep.room.name) {
        // 保持适当的跟随距离（2-3格）
        const distance = creep.pos.getRangeTo(followTarget);
        if (distance > 3) {
          creep.moveTo(followTarget);
        } else if (distance < 2) {
          // 太近了，稍微远离
          this.keepDistance(creep, followTarget);
        }
        return;
      }
    }

    // 没有跟随目标时，巡逻
    this.patrol(creep);
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
        creep.moveTo(newPos);
      }
    }
  }

  // 巡逻逻辑
  private static patrol(creep: Creep): void {
    // 在房间中心的安全区域巡逻
    const centerX = 25;
    const centerY = 25;

    if (!creep.memory.patrolPoint) {
      creep.memory.patrolPoint = {
        x: centerX + (Math.random() - 0.5) * 6,
        y: centerY + (Math.random() - 0.5) * 6
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

  // 检查是否需要紧急治疗（预留功能）
  // private static needsEmergencyHeal(creep: Creep): boolean {
  //   // 检查周围是否有生命值很低的友军
  //   const criticalAllies = creep.room.find(FIND_MY_CREEPS, {
  //     filter: (ally) => ally.hits < ally.hitsMax * 0.3 && creep.pos.getRangeTo(ally) <= 3
  //   });
  //
  //   return criticalAllies.length > 0;
  // }
}
