export class RoleStaticHarvester {
  public static run(creep: Creep): void {
    if (!creep.memory.targetId) {
      creep.say('⏳ 等待分配');
      return;
    }

    const [x, y] = creep.memory.targetId.split(',').map(Number);
    const targetPos = new RoomPosition(x, y, creep.room.name);

    // 检查是否到达目标位置
    if (!creep.pos.isEqualTo(targetPos)) {
      // 检查目标位置是否被其他 creep 占用
      const creepsAtTarget = targetPos.lookFor(LOOK_CREEPS);
      const isTargetOccupied = creepsAtTarget.some(c => c.id !== creep.id);

      if (isTargetOccupied) {
        // 目标位置被占用，等待重新分配
        creep.say('⏳ 位置被占用');
        return;
      }

      // 检查是否已经在矿点可用位置附近（距离=1格）
      const distanceToTarget = creep.pos.getRangeTo(targetPos);
      if (distanceToTarget === 1) {
        // 距离矿点可用位置=1格，可以开始挖矿
        creep.say('⛏️ 工作中');
        this.startMining(creep);
        return;
      }

      // 距离矿点可用位置>1格，需要运输
      creep.say('⏳ 等待运输');
      return;
    }

    // 到达目标位置，开始挖矿
    creep.say('⛏️ 工作中');
    this.startMining(creep);
  }

  // 开始挖矿
  private static startMining(creep: Creep): void {
    const sources = creep.room.find(FIND_SOURCES);
    if (sources.length > 0) {
      const nearestSource = creep.pos.findClosestByPath(sources);
      if (nearestSource) {
        const result = creep.harvest(nearestSource);

        if (result === ERR_NOT_IN_RANGE) {
          creep.say('⚠️ 位置偏移');
          return;
        } else if (result === OK) {
          creep.say('💎');
        }
      }
    }
  }
}
