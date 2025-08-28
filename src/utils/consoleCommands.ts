// 简化的控制台命令工具
// 只保留核心命令，移除复杂的威胁评估和编组系统

// 简化的攻击命令 - 主要命令
export function attack(sourceRoom: string, targetRoom: string): void {
  const room = Game.rooms[sourceRoom];
  if (!room) {
    console.log(`❌ 房间 ${sourceRoom} 不存在或不可见`);
    return;
  }

  if (!room.controller?.my) {
    console.log(`❌ 房间 ${sourceRoom} 不是您的房间`);
    return;
  }

  if (targetRoom === sourceRoom) {
    console.log(`❌ 不能攻击自己的房间`);
    return;
  }

  console.log(`🚀 开始攻击: ${sourceRoom} → ${targetRoom}`);

  // 查找可用的战斗单位（只需要tank用于测试）
  const availableTanks = room.find(FIND_MY_CREEPS, {
    filter: (creep) => creep.memory.role === 'tank' && !creep.memory.attackTarget
  });

  if (availableTanks.length === 0) {
    console.log(`❌ 房间 ${sourceRoom} 没有可用的tank单位`);
    console.log(`💡 请等待tank生产完成或者使用 Game.creeps['tank名称'].memory.attackTarget = '${targetRoom}' 手动分配`);
    return;
  }

  // 直接为tank分配攻击任务
  let assignedCount = 0;
  for (const tank of availableTanks) {
    tank.memory.attackTarget = targetRoom;
    console.log(`✅ Tank ${tank.name} 已分配攻击任务: ${targetRoom}`);
    assignedCount++;
  }

  console.log(`🎯 攻击任务分配完成: ${assignedCount} 个tank单位开始攻击 ${targetRoom}`);
  console.log(`📊 使用简化的攻击系统，无需复杂的编组和威胁评估`);
}

// 测试移动命令 - 使用简化的官方推荐算法
export function testMove(creepName: string, targetRoom: string): void {
  const creep = Game.creeps[creepName];
  if (!creep) {
    console.log(`❌ Creep ${creepName} 不存在`);
    return;
  }

  if (creep.memory.role !== 'tank') {
    console.log(`❌ 只能对tank单位使用测试移动命令`);
    return;
  }

  // 清理旧的测试数据
  delete creep.memory.attackTarget;
  delete creep.memory.testStartTime;
  delete creep.memory.testStartRoom;

  creep.memory.testMoveToRoom = targetRoom;
  console.log(`✅ Tank ${creepName} 开始简化测试移动到房间 ${targetRoom}`);
  console.log(`📖 使用官方推荐的基于视野检测算法`);
  console.log(`🔍 当前位置: ${creep.room.name} (${creep.pos.x}, ${creep.pos.y})`);
  console.log(`👁️ 目标房间视野: ${Game.rooms[targetRoom] ? '有' : '无'}`);
}

// 显示可用的tank状态
export function showTanks(): void {
  const tanks = Object.values(Game.creeps).filter(creep => creep.memory.role === 'tank');
  
  if (tanks.length === 0) {
    console.log('❌ 当前没有tank单位');
    return;
  }

  console.log(`🛡️ 当前tank单位状态 (共${tanks.length}个):`);
  tanks.forEach((tank, index) => {
    const status = tank.memory.attackTarget ? 
      `攻击${tank.memory.attackTarget}` : 
      tank.memory.testMoveToRoom ? 
        `测试移动到${tank.memory.testMoveToRoom}` : 
        '空闲';
    const hp = `${tank.hits}/${tank.hitsMax}`;
    console.log(`  ${index + 1}. ${tank.name} - 状态: ${status} - 生命值: ${hp} - 房间: ${tank.room.name}`);
  });
}

// 停止攻击命令
export function stopAttack(creepName?: string): void {
  if (creepName) {
    // 停止指定creep的攻击
    const creep = Game.creeps[creepName];
    if (!creep) {
      console.log(`❌ Creep ${creepName} 不存在`);
      return;
    }
    
    delete creep.memory.attackTarget;
    delete creep.memory.testMoveToRoom;
    console.log(`✅ ${creepName} 停止攻击，返回空闲状态`);
  } else {
    // 停止所有tank的攻击
    const tanks = Object.values(Game.creeps).filter(creep => creep.memory.role === 'tank');
    let stoppedCount = 0;
    
    tanks.forEach(tank => {
      if (tank.memory.attackTarget || tank.memory.testMoveToRoom) {
        delete tank.memory.attackTarget;
        delete tank.memory.testMoveToRoom;
        stoppedCount++;
      }
    });
    
    console.log(`✅ 停止了 ${stoppedCount} 个tank的攻击任务`);
  }
}

// 显示帮助信息
export function help(): void {
  console.log('🎮 战斗系统命令:');
  console.log('  attack(sourceRoom, targetRoom) - 攻击指定房间');
  console.log('  testMove(creepName, targetRoom) - 简单测试tank移动');
  console.log('  showTanks() - 显示所有tank单位状态');
  console.log('  stopAttack(creepName?) - 停止攻击任务');
  console.log('');
  console.log('🧪 跨房间移动测试命令:');
  console.log('  startCrossRoomTest(tankName, targetRoom) - 开始详细测试');
  console.log('  checkTest(tankName) - 检查测试进度');
  console.log('  debugTest(tankName) - 详细调试信息');
  console.log('  stopTest(tankName) - 停止测试');
  console.log('  batchTest(targetRoom) - 测试所有tank');
  console.log('  checkBatchTest() - 检查批量测试进度');
  console.log('');
  console.log('🔍 搬运工诊断命令:');
  console.log('  diagnoseCarriers() - 全面诊断搬运工状态');
  console.log('  analyzeCarrier(creepName) - 分析特定搬运工');
  console.log('  forceAssignTasks(roomName) - 强制重新分配任务');
  console.log('');
  console.log('💡 使用示例:');
  console.log('  attack("W1N1", "W1N2") - 从W1N1攻击W1N2');
  console.log('  startCrossRoomTest("tank_123", "W3N5") - 测试tank_123移动到W3N5');
  console.log('  checkTest("tank_123") - 查看测试进度');
  console.log('  debugTest("tank_123") - 如果卡住了，查看详细信息');
  console.log('  showTanks() - 查看所有tank状态');
  console.log('  diagnoseCarriers() - 检查搬运工问题');
  console.log('  analyzeCarrier("carrier_123") - 详细分析搬运工');
}