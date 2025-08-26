// 任务系统：协调 Carrier 和静态矿工
export function updateTaskSystem(room: Room): void {
  // 检查是否有需要帮助的静态矿工
  const staticHarvesters = room.find(FIND_MY_CREEPS, {
    filter: creep => creep.memory.role === 'staticHarvester'
  });

  const carriers = room.find(FIND_MY_CREEPS, {
    filter: creep => creep.memory.role === 'carrier'
  });

  // 为需要帮助的静态矿工分配 Carrier
  for (const harvester of staticHarvesters) {
    if (harvester.memory.targetId && !harvester.pos.isEqualTo(new RoomPosition(
      parseInt(harvester.memory.targetId.split(',')[0]),
      parseInt(harvester.memory.targetId.split(',')[1]),
      harvester.room.name
    ))) {
      // 寻找空闲的 Carrier 来帮助
      const availableCarrier = carriers.find(carrier =>
        !carrier.memory.working &&
        carrier.store.getUsedCapacity() === 0 &&
        !carrier.memory.targetId
      );

      if (availableCarrier) {
        availableCarrier.memory.targetId = harvester.id;
        availableCarrier.say('🚶 帮助移动');
      }
    }
  }

  // 清理已完成的任务
  for (const carrier of carriers) {
    if (carrier.memory.targetId && carrier.memory.targetId.startsWith('staticHarvester_')) {
      const targetHarvester = Game.getObjectById(carrier.memory.targetId) as Creep;
      if (!targetHarvester || targetHarvester.memory.role !== 'staticHarvester') {
        delete carrier.memory.targetId;
      }
    }
  }
}

// 管理静态矿工
export function manageStaticHarvesters(room: Room): void {
  const staticHarvesters = room.find(FIND_MY_CREEPS, {
    filter: creep => creep.memory.role === 'staticHarvester'
  });

  // 获取所有采矿点
  const miningSpots = Memory.rooms[room.name]?.miningSpots || [];

  // 为每个静态矿工分配采矿点
  for (const harvester of staticHarvesters) {
    if (!harvester.memory.targetId) {
      // 寻找可用的采矿点（没有被其他 creep 占用的）
      let bestSpot: string | null = null;
      let bestDistance = Infinity;

      for (const spot of miningSpots) {
        const [x, y] = spot.split(',').map(Number);
        const spotPos = new RoomPosition(x, y, room.name);

        // 检查这个位置是否已经被其他 creep 占用
        const creepsAtSpot = room.lookForAt(LOOK_CREEPS, spotPos);
        const isOccupied = creepsAtSpot.some(c => c.id !== harvester.id);

        if (!isOccupied) {
          const distance = harvester.pos.getRangeTo(spotPos);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestSpot = spot;
          }
        }
      }

      if (bestSpot) {
        harvester.memory.targetId = bestSpot;
        console.log(`静态矿工 ${harvester.name} 分配到采矿点: ${bestSpot}`);
      }
    }
  }
}
