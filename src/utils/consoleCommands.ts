// 简化的控制台命令工具
// 只保留核心命令，移除复杂的威胁评估和编组系统

// 诊断搬运工供应任务循环问题
export function diagnoseSupplyLoop(roomName?: string): void {
  const targetRoom = roomName || Object.keys(Game.rooms)[0];
  const room = Game.rooms[targetRoom];
  if (!room) {
    console.log(`❌ 房间 ${targetRoom} 无视野`);
    return;
  }

  console.log(`\n🔍 诊断房间 ${targetRoom} 的供应循环问题:`);
  
  // 检查搬运工状态
  const carriers = room.find(FIND_MY_CREEPS, {
    filter: c => c.memory.role === 'carrier'
  });
  
  console.log(`📊 搬运工数量: ${carriers.length}`);
  
  carriers.forEach(carrier => {
    const { TaskSystem } = require('../managers/taskSystem');
    const task = TaskSystem.getCreepTask(carrier);
    
    console.log(`\n🚛 ${carrier.name}:`);
    console.log(`  位置: (${carrier.pos.x},${carrier.pos.y})`);
    console.log(`  能量: ${carrier.store[RESOURCE_ENERGY]}/${carrier.store.getCapacity()}`);
    console.log(`  当前任务: ${task ? task.type : '无'}`);
    console.log(`  显示文字: ${(carrier as any).saying || '无'}`);
    
    if (task) {
      console.log(`  任务ID: ${task.id}`);
      console.log(`  任务状态: ${task.status}`);
      console.log(`  目标ID: ${task.targetId}`);
      
      if (task.targetId) {
        const target = Game.getObjectById(task.targetId);
        if (target) {
          console.log(`  目标存在: ${(target as any).structureType} at (${(target as any).pos.x},${(target as any).pos.y})`);
          if ((target as any).structureType === STRUCTURE_SPAWN || (target as any).structureType === STRUCTURE_EXTENSION) {
            const structure = target as StructureSpawn | StructureExtension;
            console.log(`  目标能量: ${structure.store[RESOURCE_ENERGY]}/${structure.store.getCapacity(RESOURCE_ENERGY)}`);
            console.log(`  需要能量: ${structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ? '是' : '否'}`);
          }
        } else {
          console.log(`  ⚠️ 目标不存在!`);
        }
      }
    }
  });
  
  // 检查静态工人状态
  const staticWorkers = room.find(FIND_MY_CREEPS, {
    filter: c => c.memory.role === 'staticHarvester' || c.memory.role === 'upgrader'
  });
  
  console.log(`\n👷 静态工人状态:`);
  staticWorkers.forEach(worker => {
    console.log(`\n⚡ ${worker.name} (${worker.memory.role}):`);
    console.log(`  位置: (${worker.pos.x},${worker.pos.y})`);
    console.log(`  目标位置: ${worker.memory.targetId || '未分配'}`);
    console.log(`  工作状态: ${(worker.memory as any).working ? '工作中' : '等待'}`);
    console.log(`  显示文字: ${(worker as any).saying || '无'}`);
    
    if (worker.memory.targetId) {
      const [targetX, targetY] = worker.memory.targetId.split(',').map(Number);
      const atTarget = worker.pos.x === targetX && worker.pos.y === targetY;
      console.log(`  是否在目标位置: ${atTarget ? '是' : '否'}`);
      
      if (!atTarget) {
        // 检查是否有搬运任务
        const roomMemory = Memory.rooms[targetRoom];
        if (roomMemory && roomMemory.tasks) {
          const taskType = worker.memory.role === 'staticHarvester' ? 'assistStaticHarvester' : 'assistStaticUpgrader';
          const workerIdField = worker.memory.role === 'staticHarvester' ? 'harvesterId' : 'upgraderId';
          
          const transportTask = Object.values(roomMemory.tasks).find((task: any) =>
            task.type === taskType && task[workerIdField] === worker.id
          );
          
          if (transportTask) {
            console.log(`  搬运任务: ${(transportTask as any).status}`);
            console.log(`  分配给: ${(transportTask as any).assignedTo || '未分配'}`);
          } else {
            console.log(`  ⚠️ 没有搬运任务!`);
          }
        }
      }
    }
  });
  
  console.log(`\n结束诊断`);
}

// 快速修复卡住的供应任务
export function fixStuckSupplyTasks(roomName?: string): void {
  const targetRoom = roomName || Object.keys(Game.rooms)[0];
  const roomMemory = Memory.rooms[targetRoom];
  
  if (!roomMemory || !roomMemory.tasks) {
    console.log(`❌ 房间 ${targetRoom} 没有任务系统`);
    return;
  }
  
  let fixedCount = 0;
  
  Object.values(roomMemory.tasks!).forEach((task: any) => {
    if (task.type === 'supplySpawn' || task.type === 'supplyExtension') {
      const target = Game.getObjectById(task.targetId);
      if (!target) {
        console.log(`🗑️ 删除无效供应任务: ${task.id}`);
        delete roomMemory.tasks![task.id];
        fixedCount++;
        return;
      }
      
      const structure = target as StructureSpawn | StructureExtension;
      if (structure.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        console.log(`✅ 删除已满供应任务: ${task.id}`);
        delete roomMemory.tasks![task.id];
        fixedCount++;
      }
    }
  });
  
  console.log(`🔧 修复了 ${fixedCount} 个卡住的供应任务`);
}

// 清理creep的move缓存（修复跨房间移动卡住问题）
export function clearMoveCache(creepName: string): void {
  const creep = Game.creeps[creepName];
  if (!creep) {
    console.log(`❌ Creep ${creepName} 不存在`);
    return;
  }

  delete (creep.memory as any)._move;
  console.log(`✅ 已清理 ${creepName} 的move缓存`);
  console.log(`📍 当前位置: ${creep.room.name} (${creep.pos.x},${creep.pos.y})`);

  if (creep.memory.attackTarget) {
    console.log(`🎯 攻击目标: ${creep.memory.attackTarget}`);
  }
  if (creep.memory.testMoveToRoom) {
    console.log(`🧪 测试目标: ${creep.memory.testMoveToRoom}`);
  }
}

// 清理所有tank的move缓存
export function clearAllTankCache(): void {
  let clearedCount = 0;
  for (const creepName in Game.creeps) {
    const creep = Game.creeps[creepName];
    if (creep.memory.role === 'tank' && (creep.memory as any)._move) {
      delete (creep.memory as any)._move;
      clearedCount++;
      console.log(`✅ 清理了 ${creep.name} 的move缓存`);
    }
  }
  console.log(`🧹 总共清理了 ${clearedCount} 个tank的move缓存`);
}

// 检查房间连接性
export function checkRoomConnection(fromRoom: string, toRoom: string): void {
  const room = Game.rooms[fromRoom];
  if (!room) {
    console.log(`❌ 没有房间 ${fromRoom} 的视野`);
    return;
  }

  console.log(`🔍 检查房间连接: ${fromRoom} → ${toRoom}`);

  // 检查是否相邻
  const fromCoord = parseRoomName(fromRoom);
  const toCoord = parseRoomName(toRoom);

  if (!fromCoord || !toCoord) {
    console.log(`❌ 房间名格式错误`);
    return;
  }

  const dx = Math.abs(fromCoord.x - toCoord.x);
  const dy = Math.abs(fromCoord.y - toCoord.y);
  const isAdjacent = (dx <= 1 && dy <= 1) && (dx + dy > 0);

  console.log(`📍 ${fromRoom}: (${fromCoord.x}, ${fromCoord.y})`);
  console.log(`📍 ${toRoom}: (${toCoord.x}, ${toCoord.y})`);
  console.log(`📏 距离: dx=${dx}, dy=${dy}, 相邻=${isAdjacent}`);

  if (!isAdjacent) {
    console.log(`❌ 房间不相邻，无法直接移动`);
    return;
  }

  // 检查出口
  const exitDirection = room.findExitTo(toRoom);
  if (exitDirection === ERR_NO_PATH) {
    console.log(`❌ 没有到 ${toRoom} 的路径`);
  } else if (exitDirection === ERR_INVALID_ARGS) {
    console.log(`❌ 房间参数无效`);
  } else {
    console.log(`✅ 找到出口方向: ${getDirectionName(exitDirection)}`);

    // 检查出口位置
    const exits = room.find(exitDirection as FindConstant);
    console.log(`🚪 出口数量: ${exits.length}`);

    if (exits.length > 0) {
      const firstExit = exits[0] as RoomPosition;
      console.log(`🎯 第一个出口位置: (${firstExit.x}, ${firstExit.y})`);
    }
  }
}

// 解析房间名
function parseRoomName(roomName: string): {x: number, y: number} | null {
  const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
  if (!match) return null;

  const [, xDir, xNum, yDir, yNum] = match;
  const x = xDir === 'W' ? -parseInt(xNum) : parseInt(xNum);
  const y = yDir === 'N' ? -parseInt(yNum) : parseInt(yNum);

  return {x, y};
}

// 获取方向名称
function getDirectionName(direction: any): string {
  const names: {[key: number]: string} = {
    1: 'TOP',
    2: 'TOP_RIGHT',
    3: 'RIGHT',
    4: 'BOTTOM_RIGHT',
    5: 'BOTTOM',
    6: 'BOTTOM_LEFT',
    7: 'LEFT',
    8: 'TOP_LEFT'
  };
  return names[direction] || `UNKNOWN(${direction})`;
}

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

// 测试静态工人的移动状态
export function checkStaticWorkers(): void {
  console.log("=== 静态工人状态检查 ===");

  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    const staticCreeps = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'staticHarvester' || (c.memory as any).role === 'upgrader'
    });

    if (staticCreeps.length === 0) continue;

    console.log(`\n房间 ${roomName}:`);

    for (const creep of staticCreeps) {
      const role = (creep.memory as any).role;
      const hasMoveBodyParts = creep.getActiveBodyparts(MOVE);
      const isWorking = (creep.memory as any).working;
      const targetId = (creep.memory as any).targetId;

      // 查找搬运任务
      const roomMemory = Memory.rooms[roomName];
      const taskType = role === 'staticHarvester' ? 'assistStaticHarvester' : 'assistStaticUpgrader';
      const targetIdField = role === 'staticHarvester' ? 'harvesterId' : 'upgraderId';
      const task = roomMemory && (roomMemory as any).tasks ?
        Object.values((roomMemory as any).tasks).find((t: any) =>
          t.type === taskType && (t as any)[targetIdField] === creep.id
        ) : null;

      const taskStatus = task ? `${(task as any).status}${(task as any).assignedTo ? ' (已分配)' : ''}` : '无任务';

      console.log(`  ${creep.name} (${role}):
    MOVE部件: ${hasMoveBodyParts}
    工作中: ${isWorking}
    目标位置: ${targetId}
    搬运任务: ${taskStatus}`);
    }
  }

  console.log("\n=== 检查完成 ===");
}

// 详细诊断拉拽过程
export function diagnosePull(): void {
  console.log("=== 拉拽过程诊断 ===");
  
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    
    // 统计搬运工
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'carrier'
    });
    console.log(`\n房间 ${roomName}: ${carriers.length}个搬运工`);
    
    // 显示每个搬运工当前在做什么
    for (const carrier of carriers) {
      const currentTaskId = (carrier.memory as any).currentTaskId;
      if (currentTaskId) {
        const roomMemory = Memory.rooms[roomName];
        const currentTask = (roomMemory as any).tasks?.[currentTaskId];
        console.log(`  ${carrier.name}: 执行任务 ${currentTask?.type || '任务不存在'} (${currentTask?.status || 'N/A'})`);
      } else {
        console.log(`  ${carrier.name}: 空闲中`);
      }
    }
    
    // 查找搬运任务
    const roomMemory = Memory.rooms[roomName];
    if (!roomMemory || !(roomMemory as any).tasks) continue;
    
    const transportTasks = Object.values((roomMemory as any).tasks).filter((task: any) =>
      task.type === 'assistStaticHarvester' || task.type === 'assistStaticUpgrader'
    );
    
    console.log(`\n搬运任务 (${transportTasks.length}个):`);
    
    for (const task of transportTasks) {
      const taskData = task as any;
      const targetId = taskData.type === 'assistStaticHarvester' ? taskData.harvesterId : taskData.upgraderId;
      const targetCreep = Game.getObjectById(targetId) as Creep;
      const carrier = taskData.assignedTo ? 
        (Game.creeps[taskData.assignedTo] || Game.getObjectById(taskData.assignedTo)) : null;
      
      console.log(`\n  任务: ${taskData.type} (${taskData.status})`);
      console.log(`  目标: ${targetCreep?.name || '已死亡'} (${targetCreep?.pos.x},${targetCreep?.pos.y})`);
      console.log(`  搬运工: ${carrier?.name || '未分配'}`);
      
      if (targetCreep && carrier) {
        const distance = targetCreep.pos.getRangeTo(carrier.pos);
        const isNear = targetCreep.pos.isNearTo(carrier.pos);
        const targetWorking = (targetCreep.memory as any).working;
        
        console.log(`  距离: ${distance} (邻近: ${isNear})`);
        console.log(`  静态工人状态: ${targetWorking ? '工作中' : '等待搬运'}`);
        console.log(`  搬运工位置: (${carrier.pos.x},${carrier.pos.y})`);
        
        if (taskData.targetPos) {
          const targetPos = new RoomPosition(taskData.targetPos.x, taskData.targetPos.y, taskData.targetPos.roomName);
          const targetAtDestination = targetCreep.pos.isEqualTo(targetPos);
          const carrierNearDestination = carrier.pos.isNearTo(targetPos);
          
          console.log(`  目标位置: (${targetPos.x},${targetPos.y})`);
          console.log(`  静态工人在目标: ${targetAtDestination}`);
          console.log(`  搬运工接近目标: ${carrierNearDestination}`);
          
          if (isNear && !targetAtDestination) {
            console.log(`  ⚠️ 搬运工和静态工人在一起但没到目标位置 - 应该在拉拽！`);
          }
        }
      } else if (targetCreep && !carrier) {
        console.log(`  ⚠️ 静态工人等待分配搬运工`);
      }
    }
  }
  
  console.log("\n=== 诊断完成 ===");
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
  console.log('🏗️ 静态工人诊断命令:');
  console.log('  checkStaticWorkers() - 检查静态工人状态和搬运任务');
  console.log('  diagnosePull() - 详细诊断拉拽过程');
  console.log('');
  console.log('💡 使用示例:');
  console.log('  attack("W1N1", "W1N2") - 从W1N1攻击W1N2');
  console.log('  startCrossRoomTest("tank_123", "W3N5") - 测试tank_123移动到W3N5');
  console.log('  checkTest("tank_123") - 查看测试进度');
  console.log('  debugTest("tank_123") - 如果卡住了，查看详细信息');
  console.log('  showTanks() - 查看所有tank状态');
  console.log('  diagnoseCarriers() - 检查搬运工问题');
  console.log('  analyzeCarrier("carrier_123") - 详细分析搬运工');
  console.log('  checkStaticWorkers() - 检查静态工人状态');
  console.log('  diagnosePull() - 详细诊断拉拽过程');
}
