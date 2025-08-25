export class RoleStaticHarvester {
  public static run(creep: Creep): void {
    if (!creep.memory.targetId) {
      creep.say('⏳ 等待分配');
      return;
    }

    const [x, y] = creep.memory.targetId.split(',').map(Number);
    const targetPos = new RoomPosition(x, y, creep.room.name);

    // if (!creep.pos.isEqualTo(targetPos)) {
    //   creep.say('⏳ 等待运输');
    //   return;
    // }

    creep.say('⛏️ 工作中');

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
