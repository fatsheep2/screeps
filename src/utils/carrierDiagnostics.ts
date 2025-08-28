// 搬运工诊断工具
// 用于调试搬运工任务分配问题

export class CarrierDiagnostics {
  // 全面诊断搬运工状态和任务分配问题
  public static fullDiagnosis(): void {
    console.log('🔍 === 搬运工诊断报告 ===');
    
    // 1. 统计所有房间的搬运工数量
    this.analyzeCarrierCounts();
    
    // 2. 分析搬运工状态
    this.analyzeCarrierStates();
    
    // 3. 分析任务分配状态
    this.analyzeTaskAssignments();
    
    // 4. 检查生产配置
    this.analyzeProductionSettings();
    
    // 5. 检查房间能量状况
    this.analyzeRoomEnergy();
    
    console.log('📊 === 诊断报告结束 ===');
  }
  
  // 分析搬运工数量统计
  private static analyzeCarrierCounts(): void {
    console.log('\n📊 搬运工数量统计:');
    
    const myRooms = Object.values(Game.rooms).filter(room => room.controller?.my);
    
    if (myRooms.length === 0) {
      console.log('  ❌ 没有找到我的房间');
      return;
    }
    
    for (const room of myRooms) {
      const allCreeps = room.find(FIND_MY_CREEPS);
      const carriers = allCreeps.filter(creep => creep.memory.role === 'carrier');
      
      const roleCount = {
        carrier: 0,
        staticHarvester: 0,
        upgrader: 0,
        builder: 0,
        other: 0
      };
      
      allCreeps.forEach(creep => {
        const role = creep.memory.role;
        if (role in roleCount) {
          roleCount[role as keyof typeof roleCount]++;
        } else {
          roleCount.other++;
        }
      });
      
      console.log(`  房间 ${room.name}:`);
      console.log(`    总creep数: ${allCreeps.length}`);
      console.log(`    搬运工: ${carriers.length}/5 (目标: 5)`);
      console.log(`    静态矿工: ${roleCount.staticHarvester}`);
      console.log(`    升级者: ${roleCount.upgrader}`);
      console.log(`    建造者: ${roleCount.builder}`);
      console.log(`    其他: ${roleCount.other}`);
      
      if (carriers.length === 0) {
        console.log('    ⚠️  警告: 没有搬运工！');
      }
    }
  }
  
  // 分析搬运工状态
  private static analyzeCarrierStates(): void {
    console.log('\n🔍 搬运工状态分析:');
    
    const allCarriers = Object.values(Game.creeps).filter(creep => creep.memory.role === 'carrier');
    
    if (allCarriers.length === 0) {
      console.log('  ❌ 全服没有搬运工！');
      return;
    }
    
    allCarriers.forEach((carrier, index) => {
      console.log(`  ${index + 1}. 搬运工 ${carrier.name}:`);
      console.log(`     房间: ${carrier.room.name} (${carrier.pos.x}, ${carrier.pos.y})`);
      console.log(`     生命值: ${carrier.hits}/${carrier.hitsMax}`);
      console.log(`     背包: ${carrier.store.getUsedCapacity()}/${carrier.store.getCapacity()}`);
      console.log(`     工作状态: ${carrier.memory.working ? '运输' : '收集'}`);
      
      // 任务状态
      console.log(`     当前任务: ${carrier.memory.currentTaskId || '无'}`);
      console.log(`     批处理任务: ${carrier.memory.currentTaskBatch?.length || 0}个`);
      console.log(`     批处理索引: ${carrier.memory.currentTaskIndex || 'N/A'}`);
      
      // 检查是否空闲
      const isAvailable = !carrier.memory.currentTaskId && 
                         (!carrier.memory.currentTaskBatch || carrier.memory.currentTaskBatch.length === 0);
      console.log(`     是否空闲: ${isAvailable ? '✅ 是' : '❌ 否'}`);
      
      if (carrier.memory.stuckCounter) {
        console.log(`     ⚠️  卡住计数: ${carrier.memory.stuckCounter}`);
      }
    });
  }
  
  // 分析任务分配状态
  private static analyzeTaskAssignments(): void {
    console.log('\n📋 任务分配状态:');
    
    const myRooms = Object.values(Game.rooms).filter(room => room.controller?.my);
    
    for (const room of myRooms) {
      console.log(`  房间 ${room.name}:`);
      
      const roomMemory = Memory.rooms[room.name];
      if (!roomMemory || !roomMemory.tasks) {
        console.log('    ❌ 房间没有任务系统');
        continue;
      }
      
      const tasks = Object.values(roomMemory.tasks);
      
      if (tasks.length === 0) {
        console.log('    ✅ 没有待处理任务');
        continue;
      }
      
      const tasksByStatus = {
        pending: 0,
        assigned: 0,
        in_progress: 0,
        completed: 0
      };
      
      const tasksByType = {
        assistStaticHarvester: 0,
        assistStaticUpgrader: 0,
        collectEnergy: 0,
        supplyEnergy: 0,
        deliverToSpawn: 0,
        deliverToCreep: 0,
        transferEnergy: 0
      };
      
      tasks.forEach(task => {
        if (task.status in tasksByStatus) {
          tasksByStatus[task.status as keyof typeof tasksByStatus]++;
        }
        
        if (task.type in tasksByType) {
          tasksByType[task.type as keyof typeof tasksByType]++;
        }
      });
      
      console.log(`    总任务数: ${tasks.length}`);
      console.log(`    按状态: pending=${tasksByStatus.pending}, assigned=${tasksByStatus.assigned}, in_progress=${tasksByStatus.in_progress}, completed=${tasksByStatus.completed}`);
      
      // 显示前5个待处理任务
      const pendingTasks = tasks.filter(task => task.status === 'pending').slice(0, 5);
      if (pendingTasks.length > 0) {
        console.log('    ⏳ 待处理任务:');
        pendingTasks.forEach((task, index) => {
          console.log(`      ${index + 1}. ${task.type} (优先级: ${task.priority})`);
        });
      }
    }
  }
  
  // 分析生产配置
  private static analyzeProductionSettings(): void {
    console.log('\n🏭 生产配置分析:');
    
    const myRooms = Object.values(Game.rooms).filter(room => room.controller?.my);
    
    for (const room of myRooms) {
      console.log(`  房间 ${room.name}:`);
      
      const spawns = room.find(FIND_MY_SPAWNS);
      console.log(`    Spawn数量: ${spawns.length}`);
      
      spawns.forEach((spawn, index) => {
        console.log(`    Spawn${index + 1}: ${spawn.name}`);
        console.log(`      状态: ${spawn.spawning ? `正在生产 ${spawn.spawning.name}` : '空闲'}`);
        console.log(`      能量: ${spawn.store.getUsedCapacity(RESOURCE_ENERGY)}/${spawn.store.getCapacity(RESOURCE_ENERGY)}`);
      });
      
      console.log(`    房间总能量: ${room.energyAvailable}/${room.energyCapacityAvailable}`);
      
      // 检查搬运工生产成本
      const carrierCost = 4 * 50 + 2 * 50; // 4 CARRY + 2 MOVE = 300
      console.log(`    搬运工生产成本: ${carrierCost} (够生产: ${room.energyAvailable >= carrierCost ? '✅' : '❌'})`);
    }
  }
  
  // 分析房间能量状况
  private static analyzeRoomEnergy(): void {
    console.log('\n⚡ 房间能量状况:');
    
    const myRooms = Object.values(Game.rooms).filter(room => room.controller?.my);
    
    for (const room of myRooms) {
      console.log(`  房间 ${room.name}:`);
      
      // 能量来源
      const sources = room.find(FIND_SOURCES);
      console.log(`    能量来源数量: ${sources.length}`);
      
      // 容器状态
      const containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      });
      
      let totalContainerEnergy = 0;
      containers.forEach(container => {
        const energy = (container as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY);
        totalContainerEnergy += energy;
      });
      
      console.log(`    容器数量: ${containers.length}`);
      console.log(`    容器总能量: ${totalContainerEnergy}`);
      
      // 掉落资源
      const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY
      });
      
      let totalDroppedEnergy = 0;
      droppedEnergy.forEach(resource => {
        totalDroppedEnergy += resource.amount;
      });
      
      console.log(`    掉落资源数量: ${droppedEnergy.length}`);
      console.log(`    掉落能量总量: ${totalDroppedEnergy}`);
      
      // 存储状态
      if (room.storage) {
        console.log(`    仓库能量: ${room.storage.store.getUsedCapacity(RESOURCE_ENERGY)}`);
      }
    }
  }
  
  // 分析特定搬运工的详细状态
  public static analyzeCarrierDetailed(creepName: string): void {
    const creep = Game.creeps[creepName];
    if (!creep) {
      console.log(`❌ 搬运工 ${creepName} 不存在`);
      return;
    }
    
    if (creep.memory.role !== 'carrier') {
      console.log(`❌ ${creepName} 不是搬运工 (角色: ${creep.memory.role})`);
      return;
    }
    
    console.log(`🔍 搬运工 ${creepName} 详细状态:`);
    console.log(`  位置: ${creep.room.name} (${creep.pos.x}, ${creep.pos.y})`);
    console.log(`  生命值: ${creep.hits}/${creep.hitsMax} (TTL: ${creep.ticksToLive || 'N/A'})`);
    console.log(`  背包: ${creep.store.getUsedCapacity()}/${creep.store.getCapacity()}`);
    console.log(`  工作状态: ${creep.memory.working ? '运输' : '收集'}`);
    
    // 内存状态
    console.log('  内存状态:');
    console.log(`    currentTaskId: ${creep.memory.currentTaskId || '无'}`);
    console.log(`    targetId: ${creep.memory.targetId || '无'}`);
    console.log(`    lastPos: ${creep.memory.lastPos ? `(${creep.memory.lastPos.x}, ${creep.memory.lastPos.y}) tick ${creep.memory.lastPos.tick}` : '无'}`);
    console.log(`    stuckCounter: ${creep.memory.stuckCounter || 0}`);
    
    // 批处理状态
    if (creep.memory.currentTaskBatch && creep.memory.currentTaskBatch.length > 0) {
      console.log('  批处理任务:');
      console.log(`    总数: ${creep.memory.currentTaskBatch.length}`);
      console.log(`    当前索引: ${creep.memory.currentTaskIndex || 0}`);
      console.log(`    任务列表: [${creep.memory.currentTaskBatch.join(', ')}]`);
    }
    
    // 检查当前任务状态
    if (creep.memory.currentTaskId) {
      const roomMemory = Memory.rooms[creep.room.name];
      if (roomMemory && roomMemory.tasks) {
        const task = roomMemory.tasks[creep.memory.currentTaskId];
        if (task) {
          console.log('  当前任务详情:');
          console.log(`    ID: ${task.id}`);
          console.log(`    类型: ${task.type}`);
          console.log(`    优先级: ${task.priority}`);
          console.log(`    状态: ${task.status}`);
          console.log(`    创建时间: ${task.createdAt} (${Game.time - task.createdAt} ticks ago)`);
          console.log(`    分配给: ${task.assignedTo === creep.id ? '自己' : task.assignedTo || '无'}`);
        } else {
          console.log('  ⚠️  当前任务在房间内存中不存在！');
        }
      }
    }
  }
  
  // 手动强制重新分配任务
  public static forceTaskReassignment(roomName: string): void {
    const room = Game.rooms[roomName];
    if (!room) {
      console.log(`❌ 房间 ${roomName} 不存在`);
      return;
    }
    
    console.log(`🔄 强制重新分配房间 ${roomName} 的任务`);
    
    // 获取所有空闲搬运工
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: (c) => c.memory.role === 'carrier'
    });
    
    const availableCarriers = carriers.filter(carrier =>
      !carrier.memory.currentTaskId &&
      (!carrier.memory.currentTaskBatch || carrier.memory.currentTaskBatch.length === 0)
    );
    
    console.log(`  搬运工总数: ${carriers.length}`);
    console.log(`  空闲搬运工: ${availableCarriers.length}`);
    
    if (availableCarriers.length === 0) {
      console.log('  ❌ 没有空闲搬运工可分配');
      return;
    }
    
    // 获取待分配任务
    const roomMemory = Memory.rooms[roomName];
    if (!roomMemory || !roomMemory.tasks) {
      console.log('  ❌ 房间没有任务系统');
      return;
    }
    
    const pendingTasks = Object.values(roomMemory.tasks).filter(task =>
      task.status === 'pending' && !task.assignedTo
    );
    
    console.log(`  待分配任务: ${pendingTasks.length}`);
    
    if (pendingTasks.length === 0) {
      console.log('  ✅ 没有待分配的任务');
      return;
    }
    
    // 按优先级排序任务
    const priorityOrder: { [key: string]: number } = {
      'urgent': 0,
      'high': 1,
      'normal': 2,
      'low': 3
    };
    
    pendingTasks.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt; // 早创建的优先
    });
    
    // 分配任务
    let assignedCount = 0;
    for (let i = 0; i < Math.min(availableCarriers.length, pendingTasks.length); i++) {
      const carrier = availableCarriers[i];
      const task = pendingTasks[i];
      
      carrier.memory.currentTaskId = task.id;
      task.assignedTo = carrier.id;
      task.assignedAt = Game.time;
      task.status = 'assigned';
      
      roomMemory.tasks[task.id] = task;
      
      console.log(`  ✅ 分配任务 ${task.type}:${task.id} 给搬运工 ${carrier.name}`);
      assignedCount++;
    }
    
    console.log(`  🎯 总共分配了 ${assignedCount} 个任务`);
  }
}

// 全局命令
declare global {
  var diagnoseCarriers: typeof CarrierDiagnostics.fullDiagnosis;
  var analyzeCarrier: typeof CarrierDiagnostics.analyzeCarrierDetailed;
  var forceAssignTasks: typeof CarrierDiagnostics.forceTaskReassignment;
}