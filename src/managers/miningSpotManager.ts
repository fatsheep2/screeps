// 更新房间的采矿点信息
export function updateMiningSpots(room: Room): void {
  const sources = room.find(FIND_SOURCES);
  const miningSpots: string[] = [];

  console.log(`房间 ${room.name} 开始更新采矿点，找到 ${sources.length} 个资源点`);

  // 为每个资源点记录周围±1格内的可用位置
  for (const source of sources) {
    console.log(`检查资源点 (${source.pos.x},${source.pos.y}) 周围的可用位置`);

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
    Memory.rooms[room.name].miningSpots = miningSpots;
    Memory.rooms[room.name].totalAvailableSpots = miningSpots.length;
  }

  console.log(`房间 ${room.name} 可用采矿点更新完成，总共 ${miningSpots.length} 个采矿点：${miningSpots.join(', ')}`);
}

// 调试函数：检查特定位置的详细信息
export function debugPosition(room: Room, x: number, y: number): void {
  const pos = new RoomPosition(x, y, room.name);
  console.log(`=== 调试位置 (${x},${y}) ===`);

  // 检查地形
  const terrainAtPos = room.lookForAt(LOOK_TERRAIN, pos);
  console.log(`地形: ${terrainAtPos[0]}`);

  // 检查建筑
  const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, pos);
  console.log(`建筑: ${structuresAtPos.length} 个`);
  structuresAtPos.forEach(s => {
    console.log(`  - ${s.structureType} (${s.pos.x},${s.pos.y})`);
  });

  // 检查爬爬
  const creepsAtPos = room.lookForAt(LOOK_CREEPS, pos);
  console.log(`爬爬: ${creepsAtPos.length} 个`);
  creepsAtPos.forEach(c => {
    console.log(`  - ${c.name} (${c.memory.role})`);
  });

  // 检查建筑工地
  const constructionSitesAtPos = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
  console.log(`建筑工地: ${constructionSitesAtPos.length} 个`);
  constructionSitesAtPos.forEach(cs => {
    console.log(`  - ${cs.structureType} (${cs.pos.x},${cs.pos.y})`);
  });

  // 检查距离最近的资源点
  const sources = room.find(FIND_SOURCES);
  if (sources.length > 0) {
    const nearestSource = pos.findClosestByRange(sources);
    if (nearestSource) {
      const distance = pos.getRangeTo(nearestSource);
      console.log(`距离最近资源点 (${nearestSource.pos.x},${nearestSource.pos.y}): ${distance} 格`);
    }
  }

  console.log(`=== 调试完成 ===`);
}
