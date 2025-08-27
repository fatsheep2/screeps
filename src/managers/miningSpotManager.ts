// 更新房间的采矿点信息
export function updateMiningSpots(room: Room): void {
  const sources = room.find(FIND_SOURCES);
  const miningSpots: string[] = [];


  // 为每个资源点记录周围±1格内的可用位置
  for (const source of sources) {

    // 寻找资源点周围±1格内的所有位置
    for (let x = source.pos.x - 1; x <= source.pos.x + 1; x++) {
      for (let y = source.pos.y - 1; y <= source.pos.y + 1; y++) {
        if (x >= 0 && x < 50 && y >= 0 && y < 50) {
          const pos = new RoomPosition(x, y, room.name);

          // 跳过资源点本身的位置
          if (pos.isEqualTo(source.pos)) {
            continue;
          }

          // 检查位置是否在±1格范围内
          if (pos.getRangeTo(source) <= 1) {
            // 检查位置是否可用（只判断地形是否为墙）
            const terrain = room.lookForAt(LOOK_TERRAIN, pos)[0];

            // 只添加不是地形墙的位置
            if (terrain !== 'wall') {
              miningSpots.push(`${pos.x},${pos.y}`);
            } else {
            }
          }
        }
      }
    }
  }

  // 存储采矿点信息和总数量
  if (Memory.rooms[room.name]) {
    (Memory.rooms[room.name] as any).miningSpots = miningSpots;
    (Memory.rooms[room.name] as any).totalAvailableSpots = miningSpots.length;
  }

}

