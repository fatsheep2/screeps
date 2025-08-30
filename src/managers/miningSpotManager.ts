// 更新房间的采矿点信息 - 每个矿点只存储距离spawn最近的一个位置
export function updateMiningSpots(room: Room): void {
  const sources = room.find(FIND_SOURCES);
  const spawn = room.find(FIND_MY_SPAWNS)[0];

  if (!spawn) {
    console.log(`[采矿点管理] 房间 ${room.name} 没有spawn，跳过miningSpots计算`);
    return;
  }

  const optimalContainerSpots: string[] = [];

  // 为每个资源点找到距离spawn最近的一个位置
  for (const source of sources) {
    let closestPos: RoomPosition | null = null;
    let closestDistance = Infinity;

    // 寻找资源点周围±1格内的所有可用位置
    for (let x = source.pos.x - 1; x <= source.pos.x + 1; x++) {
      for (let y = source.pos.y - 1; y <= source.pos.y + 1; y++) {
        if (x >= 0 && x < 50 && y >= 0 && y < 50) {
          const pos = new RoomPosition(x, y, room.name);

          // 跳过资源点本身的位置
          if (pos.isEqualTo(source.pos)) {
            continue;
          }

          // 检查位置是否可用（不是地形墙）
          const terrain = room.lookForAt(LOOK_TERRAIN, pos)[0];
          if (terrain !== 'wall') {
            const distance = pos.getRangeTo(spawn);

            // 更新最近位置
            if (distance < closestDistance) {
              closestDistance = distance;
              closestPos = pos;
            }
          }
        }
      }
    }

    // 添加这个矿点的最优container位置
    if (closestPos) {
      optimalContainerSpots.push(`${closestPos.x},${closestPos.y}`);
      console.log(`[采矿点管理] 矿点(${source.pos.x},${source.pos.y})的最优container位置: (${closestPos.x},${closestPos.y}), 距离spawn: ${closestDistance}`);
    }
  }

  // 存储每个矿点的最优container位置
  if (Memory.rooms[room.name]) {
    (Memory.rooms[room.name] as any).miningSpots = optimalContainerSpots;
    (Memory.rooms[room.name] as any).totalAvailableSpots = optimalContainerSpots.length;

    console.log(`[采矿点管理] 房间 ${room.name} 更新完成: ${sources.length}个矿点，${optimalContainerSpots.length}个最优container位置`);
  }
}

