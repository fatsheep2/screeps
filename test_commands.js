// 测试指令文件 - 用于测试tank的跨房间移动功能

// 测试指令：让指定的tank移动到目标房间
// 使用方法：在游戏控制台中输入 moveTankToRoom('tank名称', '目标房间名称')
function moveTankToRoom(tankName, targetRoom) {
  const tank = Game.creeps[tankName];

  if (!tank) {
    console.log(`❌ 找不到名为 ${tankName} 的tank`);
    return;
  }

  if (tank.memory.role !== 'tank') {
    console.log(`❌ ${tankName} 不是tank角色`);
    return;
  }

  // 设置测试移动任务
  tank.memory.testMoveToRoom = targetRoom;

  console.log(`✅ 已为tank ${tankName} 设置跨房间移动任务到 ${targetRoom}`);
  console.log(`🚀 tank将在下一个tick开始移动到目标房间`);

  // 显示tank当前状态
  console.log(`📍 当前位置: ${tank.room.name} (${tank.pos.x}, ${tank.pos.y})`);
  console.log(`🎯 目标房间: ${targetRoom}`);
}

// 测试指令：查看所有tank的状态
function showTanksStatus() {
  const tanks = Object.values(Game.creeps).filter(creep => creep.memory.role === 'tank');

  if (tanks.length === 0) {
    console.log('❌ 当前没有tank单位');
    return;
  }

  console.log(`📊 当前有 ${tanks.length} 个tank单位:`);

  tanks.forEach((tank, index) => {
    const status = tank.memory.testMoveToRoom ?
      `🚀 正在移动到 ${tank.memory.testMoveToRoom}` :
      '⏸️ 空闲状态';

    console.log(`${index + 1}. ${tank.name}`);
    console.log(`   位置: ${tank.room.name} (${tank.pos.x}, ${tank.pos.y})`);
    console.log(`   状态: ${status}`);
    console.log(`   生命值: ${tank.hits}/${tank.hitsMax}`);
    console.log('---');
  });
}

// 测试指令：清除所有tank的测试任务
function clearAllTankTasks() {
  const tanks = Object.values(Game.creeps).filter(creep => creep.memory.role === 'tank');

  let clearedCount = 0;
  tanks.forEach(tank => {
    if (tank.memory.testMoveToRoom) {
      delete tank.memory.testMoveToRoom;
      clearedCount++;
    }
  });

  console.log(`✅ 已清除 ${clearedCount} 个tank的测试任务`);
}

// 测试指令：批量移动tank到目标房间
function moveAllTanksToRoom(targetRoom) {
  const tanks = Object.values(Game.creeps).filter(creep => creep.memory.role === 'tank');

  if (tanks.length === 0) {
    console.log('❌ 当前没有tank单位');
    return;
  }

  tanks.forEach(tank => {
    tank.memory.testMoveToRoom = targetRoom;
  });

  console.log(`✅ 已为所有 ${tanks.length} 个tank设置移动到 ${targetRoom} 的任务`);
}

// 测试指令：查看房间连接信息
function showRoomConnections(roomName) {
  const room = Game.rooms[roomName];

  if (!room) {
    console.log(`❌ 房间 ${roomName} 不存在或不可见`);
    return;
  }

  console.log(`🔗 房间 ${roomName} 的连接信息:`);

  // 查找出口
  const exits = room.find(FIND_EXIT);
  exits.forEach(exit => {
    const direction = exit.direction;
    const targetRoom = exit.room.name;
    console.log(`   出口: ${direction} -> ${targetRoom}`);
  });

  if (exits.length === 0) {
    console.log('   没有找到出口');
  }
}

// 导出测试指令到全局作用域
if (typeof global !== 'undefined') {
  global.moveTankToRoom = moveTankToRoom;
  global.showTanksStatus = showTanksStatus;
  global.clearAllTankTasks = clearAllTankTasks;
  global.moveAllTanksToRoom = moveAllTanksToRoom;
  global.showRoomConnections = showRoomConnections;
}

console.log('🎮 测试指令已加载！');
console.log('📋 可用指令:');
console.log('  moveTankToRoom(tank名称, 目标房间) - 让指定tank移动到目标房间');
console.log('  showTanksStatus() - 查看所有tank状态');
console.log('  clearAllTankTasks() - 清除所有tank的测试任务');
console.log('  moveAllTanksToRoom(目标房间) - 让所有tank移动到目标房间');
console.log('  showRoomConnections(房间名) - 查看房间连接信息');
console.log('');
console.log('💡 示例: moveTankToRoom("tank_123456_789", "W1N1")');
