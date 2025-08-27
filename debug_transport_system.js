// 调试搬运系统脚本
// 在游戏控制台中运行此脚本来诊断问题

function debugTransportSystem(roomName = null) {
  console.log('🔍 开始调试搬运系统...');

  // 如果没有指定房间，使用第一个可见的房间
  if (!roomName) {
    const visibleRooms = Object.keys(Game.rooms);
    if (visibleRooms.length === 0) {
      console.log('❌ 没有可见的房间');
      return;
    }
    roomName = visibleRooms[0];
  }

  const room = Game.rooms[roomName];
  if (!room) {
    console.log(`❌ 房间 ${roomName} 不可见`);
    return;
  }

  console.log(`\n📍 房间: ${roomName}`);

  // 1. 检查静态矿工状态
  console.log('\n👷 静态矿工状态:');
  const staticHarvesters = room.find(FIND_MY_CREEPS, {
    filter: (c) => c.memory.role === 'staticHarvester'
  });

  if (staticHarvesters.length === 0) {
    console.log('  没有静态矿工');
  } else {
    staticHarvesters.forEach((harvester, index) => {
      const targetId = harvester.memory.targetId || '未分配';
      const working = harvester.memory.working ? '工作中' : '等待搬运';
      const pos = `${harvester.pos.x},${harvester.pos.y}`;
      console.log(`  ${index + 1}. ${harvester.name}: ${working} at ${pos}, target: ${targetId}`);
    });
  }

  // 2. 检查搬运工状态
  console.log('\n🚚 搬运工状态:');
  const carriers = room.find(FIND_MY_CREEPS, {
    filter: (c) => c.memory.role === 'carrier'
  });

  if (carriers.length === 0) {
    console.log('  没有搬运工');
  } else {
    carriers.forEach((carrier, index) => {
      const hasTask = carrier.memory.currentTaskId ? `任务: ${carrier.memory.currentTaskId}` : '无任务';
      const working = carrier.memory.working ? '工作中' : '空闲';
      const pos = `${carrier.pos.x},${carrier.pos.y}`;
      console.log(`  ${index + 1}. ${carrier.name}: ${working}, ${hasTask} at ${pos}`);
    });
  }

  // 3. 检查房间任务状态
  console.log('\n📋 房间任务状态:');
  const roomMemory = Memory.rooms[roomName];
  if (!roomMemory || !roomMemory.tasks) {
    console.log('  没有任务');
  } else {
    const tasks = Object.values(roomMemory.tasks);
    if (tasks.length === 0) {
      console.log('  任务列表为空');
    } else {
      tasks.forEach((task, index) => {
        if (task.type === 'assistStaticHarvester') {
          const status = task.status;
          const assignedTo = task.assignedTo || '未分配';
          const harvesterId = task.harvesterId;
          console.log(`  ${index + 1}. 搬运任务 ${task.id}: 状态=${status}, 执行者=${assignedTo}, 矿工=${harvesterId}`);
        }
      });
    }
  }

  // 4. 检查任务管理器状态
  console.log('\n⚙️ 任务管理器状态:');
  try {
    const taskManager = getRoomTaskManager(roomName);
    const stats = taskManager.getStatistics();
    console.log(`  总任务数: ${stats.total}`);
    console.log(`  待分配: ${stats.pending}`);
    console.log(`  已分配: ${stats.assigned}`);
    console.log(`  进行中: ${stats.inProgress}`);
    console.log(`  已完成: ${stats.completed}`);
    console.log(`  失败: ${stats.failed}`);

    // 检查待分配的搬运任务
    const pendingTasks = taskManager.findTaskByFilter({
      type: 'assistStaticHarvester',
      status: 'pending'
    });
    console.log(`  待分配搬运任务: ${pendingTasks.length}`);

    pendingTasks.forEach((task, index) => {
      console.log(`    ${index + 1}. ${task.id} for ${task.harvesterId}`);
    });

  } catch (error) {
    console.log(`  任务管理器错误: ${error}`);
  }

  // 5. 检查矿工位置与目标位置
  console.log('\n🎯 位置检查:');
  staticHarvesters.forEach((harvester, index) => {
    if (harvester.memory.targetId) {
      const [targetX, targetY] = harvester.memory.targetId.split(',').map(Number);
      const targetPos = new RoomPosition(targetX, targetY, roomName);
      const distance = harvester.pos.getRangeTo(targetPos);
      const atTarget = harvester.pos.isEqualTo(targetPos);
      console.log(`  ${index + 1}. ${harvester.name}: 距离目标=${distance}, 在目标位置=${atTarget}`);
    }
  });

  console.log('\n🔍 调试完成！');
}

// 强制分配搬运任务
function forceAssignTransportTasks(roomName = null) {
  if (!roomName) {
    const visibleRooms = Object.keys(Game.rooms);
    if (visibleRooms.length === 0) {
      console.log('❌ 没有可见的房间');
      return;
    }
    roomName = visibleRooms[0];
  }

  console.log(`🔄 强制分配搬运任务到房间 ${roomName}...`);

  try {
    const taskManager = getRoomTaskManager(roomName);
    const room = Game.rooms[roomName];

    // 获取所有搬运工
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: (c) => c.memory.role === 'carrier'
    });

    // 获取所有待分配的搬运任务
    const pendingTasks = taskManager.findTaskByFilter({
      type: 'assistStaticHarvester',
      status: 'pending'
    });

    console.log(`找到 ${pendingTasks.length} 个待分配任务和 ${carriers.length} 个搬运工`);

    // 强制分配
    pendingTasks.forEach((task, index) => {
      const availableCarrier = carriers.find(carrier =>
        !carrier.memory.currentTaskId && !carrier.memory.working
      );

      if (availableCarrier) {
        // 分配任务
        task.status = 'assigned';
        task.assignedTo = availableCarrier.name;
        task.assignedAt = Game.time;

        // 写入搬运工内存
        availableCarrier.memory.currentTaskId = task.id;

        // 保存任务状态
        taskManager.updateTaskStatus(task.id, 'assigned');

        console.log(`✅ 任务 ${task.id} 强制分配给 ${availableCarrier.name}`);
      } else {
        console.log(`❌ 没有可用搬运工来执行任务 ${task.id}`);
      }
    });

  } catch (error) {
    console.log(`强制分配失败: ${error}`);
  }
}

// 清除所有搬运任务
function clearAllTransportTasks(roomName = null) {
  if (!roomName) {
    const visibleRooms = Object.keys(Game.rooms);
    if (visibleRooms.length === 0) {
      console.log('❌ 没有可见的房间');
      return;
    }
    roomName = visibleRooms[0];
  }

  console.log(`🗑️ 清除房间 ${roomName} 的所有搬运任务...`);

  try {
    const taskManager = getRoomTaskManager(roomName);
    const room = Game.rooms[roomName];

    // 清除搬运工的任务
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: (c) => c.memory.role === 'carrier'
    });

    carriers.forEach(carrier => {
      if (carrier.memory.currentTaskId) {
        console.log(`清除搬运工 ${carrier.name} 的任务: ${carrier.memory.currentTaskId}`);
        delete carrier.memory.currentTaskId;
      }
    });

    // 清除房间任务
    const roomMemory = Memory.rooms[roomName];
    if (roomMemory && roomMemory.tasks) {
      const transportTasks = Object.keys(roomMemory.tasks).filter(taskId =>
        roomMemory.tasks[taskId].type === 'assistStaticHarvester'
      );

      transportTasks.forEach(taskId => {
        console.log(`清除任务: ${taskId}`);
        delete roomMemory.tasks[taskId];
      });
    }

    console.log('✅ 所有搬运任务已清除');

  } catch (error) {
    console.log(`清除任务失败: ${error}`);
  }
}

// 导出到全局
if (typeof global !== 'undefined') {
  global.debugTransportSystem = debugTransportSystem;
  global.forceAssignTransportTasks = forceAssignTransportTasks;
  global.clearAllTransportTasks = clearAllTransportTasks;
}

console.log('🔧 搬运系统调试脚本已加载！');
console.log('📋 可用命令:');
console.log('  debugTransportSystem(房间名) - 调试搬运系统');
console.log('  forceAssignTransportTasks(房间名) - 强制分配搬运任务');
console.log('  clearAllTransportTasks(房间名) - 清除所有搬运任务');
console.log('');
console.log('💡 示例: debugTransportSystem("W0N1")');
