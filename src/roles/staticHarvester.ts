export class RoleStaticHarvester {
  public static run(creep: Creep): void {
    if (!creep.memory.targetId) {
      creep.say('⏳ 等待分配');
      return;
    }

    const [x, y] = creep.memory.targetId.split(',').map(Number);
    const targetPos = new RoomPosition(x, y, creep.room.name);

    // 检查是否在矿点±1范围内
    const distanceToTarget = creep.pos.getRangeTo(targetPos);

    if (distanceToTarget <= 1) {
      // 在矿点±1范围内，可以工作
      creep.memory.working = true;
      creep.say('⛏️ 工作中');
      this.startMining(creep);
    } else {
      // 不在矿点±1范围内，等待运输
      creep.memory.working = false;
      creep.say('⏳ 等待运输');
    }
  }

  // 开始挖矿
  private static startMining(creep: Creep): void {
    const sources = creep.room.find(FIND_SOURCES);
    if (sources.length > 0) {
      const nearestSource = creep.pos.findClosestByPath(sources);
      if (nearestSource) {
        // 检查是否在矿点附近（距离≤1格）
        const distanceToSource = creep.pos.getRangeTo(nearestSource);
        if (distanceToSource <= 1) {
          // 在矿点附近，可以挖矿
          const result = creep.harvest(nearestSource);

          if (result === OK) {
            creep.say('💎');
          } else if (result === ERR_NOT_IN_RANGE) {
            // 虽然距离≤1格，但仍然无法挖矿，可能是位置问题
            creep.say('⚠️ 位置偏移');
            console.log(`静态矿工 ${creep.name} 距离矿点 ${distanceToSource} 格，但无法挖矿`);
          } else {
            // 其他错误
            creep.say('❌ 挖矿失败');
            console.log(`静态矿工 ${creep.name} 挖矿失败，错误码: ${result}`);
          }
        } else {
          // 不在矿点附近，需要移动到矿点附近
          creep.say('🚶 移动到矿点');
          creep.moveTo(nearestSource, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    }
  }
}
