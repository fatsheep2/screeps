export class RoleStaticHarvester {
  public static run(creep: Creep): void {
    if (!creep.memory.targetId) {
      creep.say('⏳ 等待分配');
      return;
    }

    const [x, y] = creep.memory.targetId.split(',').map(Number);
    const targetPos = new RoomPosition(x, y, creep.room.name);

    // 直接执行 travel 方法，根据返回值判断 working 状态
    const canWork = this.travel(creep, targetPos);

    if (canWork) {
      // 可以工作，执行挖矿
      creep.memory.working = true;
      creep.say('⛏️ 工作中');
      this.startMining(creep);
    } else {
      // 不能工作，等待运输
      creep.memory.working = false;
      creep.say('⏳ 等待运输');
    }
  }

  // travel 方法：检查是否可以到达采矿点并工作
  private static travel(creep: Creep, targetPos: RoomPosition): boolean {
    // 检查是否在采矿点±1范围内
    const distanceToTarget = creep.pos.getRangeTo(targetPos);

    if (distanceToTarget <= 1) {
      // 在采矿点±1范围内，尝试挖矿看是否真的可以工作
      const sources = creep.room.find(FIND_SOURCES_ACTIVE);
      if (sources.length > 0) {
        const nearestSource = creep.pos.findClosestByRange(sources);
        if (nearestSource) {
          const harvestResult = creep.harvest(nearestSource);
          if (harvestResult === OK) {
            // 挖矿成功，可以工作
            return true;
          } else if (harvestResult === ERR_NOT_IN_RANGE) {
            // 虽然距离≤1格，但仍然无法挖矿，需要移动到资源点
            creep.moveTo(nearestSource, { visualizePathStyle: { stroke: '#ffaa00' } });
            return false;
          } else {
            // 其他挖矿错误
            console.log(`静态矿工 ${creep.name} 挖矿失败，错误码: ${harvestResult}`);
            return false;
          }
        }
      }
      return false;
    } else {
      // 不在采矿点±1范围内，尝试移动到采矿点
      const result = creep.moveTo(targetPos, {
        visualizePathStyle: { stroke: '#ffaa00' },
        reusePath: 5
      });

      if (result === OK || result === ERR_TIRED) {
        // 移动成功或疲劳，继续移动
        return false;
      } else {
        // 移动失败，可能是路径问题
        console.log(`静态矿工 ${creep.name} 移动失败，错误码: ${result}`);
        return false;
      }
    }
  }

  // 开始挖矿
  private static startMining(creep: Creep): void {
    // 挖矿逻辑已经在 travel 方法中处理，这里只需要显示工作状态
    creep.say('💎');
  }
}
