// 控制台命令工具
// 这些函数可以在游戏控制台中直接调用

// 手动攻击命令
export function attack(roomName: string, targetRoom: string): void {
  const room = Game.rooms[roomName];
  if (!room) {
    console.log(`❌ 房间 ${roomName} 不存在或不可见`);
    return;
  }

  if (!room.controller?.my) {
    console.log(`❌ 房间 ${roomName} 不是您的房间`);
    return;
  }

  // 检查目标房间是否有效
  if (targetRoom === roomName) {
    console.log(`❌ 不能攻击自己的房间`);
    return;
  }

  // 直接调用全局函数，而不是使用 require
  if (typeof global.manualAttack === 'function') {
    const taskId = global.manualAttack(room, targetRoom);
    if (taskId) {
      console.log(`✅ 攻击任务创建成功: ${taskId}`);
      console.log(`🎯 目标: ${targetRoom}`);
      console.log(`🚀 源房间: ${roomName}`);
    } else {
      console.log(`❌ 攻击任务创建失败`);
    }
  } else {
    console.log(`❌ 攻击系统未加载，请等待代码部署完成`);
  }
}

// 强制攻击命令（忽略战斗力量不足的限制）
export function forceAttack(roomName: string, targetRoom: string): void {
  const room = Game.rooms[roomName];
  if (!room) {
    console.log(`❌ 房间 ${roomName} 不存在或不可见`);
    return;
  }

  if (!room.controller?.my) {
    console.log(`❌ 房间 ${roomName} 不是您的房间`);
    return;
  }

  if (targetRoom === roomName) {
    console.log(`❌ 不能攻击自己的房间`);
    return;
  }

  console.log(`🚨 强制攻击模式：${roomName} → ${targetRoom}`);
  console.log(`⚠️ 注意：即使战斗力量不足也会执行攻击`);

  // 直接调用 manualAttack 函数，不进行任何战斗力量检查
  if (typeof global.manualAttack === 'function') {
    // 临时修改全局函数以支持强制攻击
    const originalManualAttack = global.manualAttack;

    // 重写 manualAttack 函数以跳过战斗力量检查
    global.manualAttack = (sourceRoom: Room, targetRoom: string) => {
      console.log(`手动触发攻击: ${sourceRoom.name} → ${targetRoom}`);

      // 检查是否有可用的战斗小组
      const availableSquads = (global as any).getRoomCombatSquads?.(sourceRoom) || [];

      if (availableSquads.length === 0) {
        console.log(`❌ 房间 ${sourceRoom.name} 没有可用的战斗小组`);
        return null;
      }

      // 直接创建攻击任务，不进行战斗力量评估
      const taskId = `attack_${Game.time}_${Math.floor(Math.random() * 1000)}`;
      const task: any = {
        id: taskId,
        targetRoom,
        sourceRoom: sourceRoom.name,
        squads: availableSquads.map((squad: any) => squad.id),
        status: 'planning',
        priority: 'critical',
        createdAt: Game.time,
        targetType: 'room',
        estimatedEnergy: 2000,
        currentEnergy: sourceRoom.energyAvailable
      };

      // 存储攻击任务
      if (!Memory.attackTasks) Memory.attackTasks = {};
      Memory.attackTasks![taskId] = task;

      // 为战斗小组分配攻击任务
      for (const squadId of task.squads) {
        if (Memory.combatSquads && Memory.combatSquads[squadId]) {
          Memory.combatSquads[squadId].attackTaskId = taskId;
          Memory.combatSquads[squadId].status = 'engaged';
        }
      }

      console.log(`✅ 强制攻击任务创建成功: ${taskId}`);
      console.log(`🎯 使用 ${availableSquads.length} 个战斗小组攻击 ${targetRoom}`);

      // 立即执行攻击任务
      if (typeof global.executeAttackTask === 'function') {
        global.executeAttackTask(taskId);
        console.log(`🚀 攻击任务 ${taskId} 开始执行！`);
      } else {
        console.log(`⚠️ 攻击任务已创建，但执行系统未加载`);
      }

      return taskId;
    };

    // 执行强制攻击
    const taskId = global.manualAttack(room, targetRoom);

    // 恢复原始函数
    global.manualAttack = originalManualAttack;

    if (!taskId) {
      console.log(`❌ 强制攻击任务创建失败`);
    }
  } else {
    console.log(`❌ 攻击系统未加载`);
  }
}

// 手动创建战斗编组
export function createSquad(roomName: string): void {
  const room = Game.rooms[roomName];
  if (!room) {
    console.log(`❌ 房间 ${roomName} 不存在或不可见`);
    return;
  }

  if (!room.controller?.my) {
    console.log(`❌ 房间 ${roomName} 不是您的房间`);
    return;
  }

  console.log(`🔧 手动创建战斗编组: ${roomName}`);

  // 检查房间中的战斗单位
  const combatCreeps = room.find(FIND_MY_CREEPS, {
    filter: creep => creep.memory.role && ['tank', 'warrior', 'archer', 'healer'].includes(creep.memory.role)
  });

  if (combatCreeps.length === 0) {
    console.log(`❌ 房间 ${roomName} 中没有战斗单位`);
    return;
  }

  // 按角色分组
  const roleGroups: Record<string, Creep[]> = {};
  for (const role of ['tank', 'warrior', 'archer', 'healer']) {
    roleGroups[role] = combatCreeps.filter(creep => creep.memory.role === role);
  }

  // 检查是否有足够的角色来组成编组
  const canFormSquad = ['tank', 'warrior', 'archer', 'healer'].every(role =>
    roleGroups[role].filter(creep => !creep.memory.squadId).length > 0
  );

  if (!canFormSquad) {
    console.log(`❌ 无法组成完整编组，需要每个角色至少有一个可用单位`);
    console.log(`当前状态:`);
    for (const role of ['tank', 'warrior', 'archer', 'healer']) {
      const available = roleGroups[role].filter(creep => !creep.memory.squadId).length;
      const total = roleGroups[role].length;
      console.log(`  ${role}: ${available}/${total} 可用`);
    }
    return;
  }

  // 创建新的战斗编组
  const squadId = `manual_squad_${Game.time}_${Math.floor(Math.random() * 1000)}`;

  // 为每个角色分配一个单位到战斗小组
  for (const role of ['tank', 'warrior', 'archer', 'healer']) {
    const creep = roleGroups[role].find(c => !c.memory.squadId);
    if (creep) {
      creep.memory.squadId = squadId;
      console.log(`✅ ${role}: ${creep.name} 加入编组 ${squadId}`);
    }
  }

  // 创建战斗小组内存记录
  if (!Memory.combatSquads) Memory.combatSquads = {};
  Memory.combatSquads[squadId] = {
    id: squadId,
    members: {
      tank: roleGroups.tank.find(c => c.memory.squadId === squadId)?.name || '',
      warrior: roleGroups.warrior.find(c => c.memory.squadId === squadId)?.name || '',
      archer: roleGroups.archer.find(c => c.memory.squadId === squadId)?.name || '',
      healer: roleGroups.healer.find(c => c.memory.squadId === squadId)?.name || ''
    },
    status: 'ready',
    formationTime: Game.time
  };

  console.log(`🎉 战斗编组 ${squadId} 创建成功！`);
  console.log(`📊 编组状态: 准备就绪`);
}

// 手动补充编组
export function refillSquad(squadId: string): void {
  if (!Memory.combatSquads || !Memory.combatSquads[squadId]) {
    console.log(`❌ 编组 ${squadId} 不存在`);
    return;
  }

  const squad = Memory.combatSquads[squadId];
  console.log(`🔧 补充编组: ${squadId}`);

  // 检查哪些角色缺失
  const missingRoles: string[] = [];
  for (const [role, memberName] of Object.entries(squad.members)) {
    if (!memberName || !Game.creeps[memberName]) {
      missingRoles.push(role);
    }
  }

  if (missingRoles.length === 0) {
    console.log(`✅ 编组 ${squadId} 人员完整，无需补充`);
    return;
  }

  console.log(`📋 需要补充的角色: ${missingRoles.join(', ')}`);

  // 查找可用的战斗单位来补充
  for (const role of missingRoles) {
         const availableCreeps = Object.values(Game.creeps).filter(creep =>
       creep.memory.role === role &&
       !creep.memory.squadId &&
       creep.room.name === Game.rooms[squad.id.split('_')[0] || '']?.name
     );

    if (availableCreeps.length > 0) {
      const creep = availableCreeps[0];
      creep.memory.squadId = squadId;
      squad.members[role as keyof typeof squad.members] = creep.name;
      console.log(`✅ 补充 ${role}: ${creep.name}`);
    } else {
      console.log(`❌ 无法找到可用的 ${role} 角色`);
    }
  }

  // 检查编组是否完整
  const isComplete = Object.values(squad.members).every(memberName =>
    memberName && Game.creeps[memberName]
  );

  if (isComplete) {
    squad.status = 'ready';
    console.log(`🎉 编组 ${squadId} 补充完成，状态: 准备就绪`);
  } else {
    squad.status = 'forming';
    console.log(`⚠️ 编组 ${squadId} 仍有缺失，状态: 组建中`);
  }
}

// 查看攻击任务状态
export function showAttackTasks(): void {
  if (!Memory.attackTasks || Object.keys(Memory.attackTasks).length === 0) {
    console.log('📋 当前没有攻击任务');
    return;
  }

  console.log('📋 当前攻击任务:');
  for (const taskId in Memory.attackTasks) {
    const task = Memory.attackTasks[taskId];
    console.log(`  🎯 ${taskId}:`);
    console.log(`     状态: ${task.status}`);
    console.log(`     目标: ${task.targetRoom}`);
    console.log(`     源房间: ${task.sourceRoom}`);
    console.log(`     优先级: ${task.priority}`);
    console.log(`     创建时间: ${Game.time - task.createdAt} tick前`);
    console.log(`     战斗小组: ${task.squads.length} 个`);
    console.log('  ---');
  }
}

// 取消攻击任务
export function cancelAttack(taskId: string): void {
  if (!Memory.attackTasks || !Memory.attackTasks[taskId]) {
    console.log(`❌ 攻击任务 ${taskId} 不存在`);
    return;
  }

  const task = Memory.attackTasks[taskId];

  // 清理战斗小组的任务关联
  if (Memory.combatSquads) {
    for (const squadId of task.squads) {
      const squad = Memory.combatSquads[squadId];
      if (squad) {
        delete squad.attackTaskId;
        squad.status = 'ready';
      }
    }
  }

  // 清理Creep的任务关联
  for (const squadId of task.squads) {
    if (Memory.combatSquads && Memory.combatSquads[squadId]) {
      const squad = Memory.combatSquads[squadId];
      for (const memberName of Object.values(squad.members)) {
        const member = Game.creeps[memberName];
        if (member) {
          delete member.memory.attackTarget;
          delete member.memory.attackTaskId;
        }
      }
    }
  }

  // 删除任务
  delete Memory.attackTasks[taskId];
  console.log(`✅ 攻击任务 ${taskId} 已取消`);
}

// 查看战斗小组状态
export function showCombatSquads(): void {
  if (!Memory.combatSquads || Object.keys(Memory.combatSquads).length === 0) {
    console.log('⚔️ 当前没有战斗小组');
    return;
  }

  console.log('⚔️ 当前战斗小组:');
  for (const squadId in Memory.combatSquads) {
    const squad = Memory.combatSquads[squadId];
    console.log(`  🛡️ ${squadId}:`);
    console.log(`     状态: ${squad.status}`);
    console.log(`     坦克: ${squad.members.tank || '无'}`);
    console.log(`     战士: ${squad.members.warrior || '无'}`);
    console.log(`     弓箭手: ${squad.members.archer || '无'}`);
    console.log(`     牧师: ${squad.members.healer || '无'}`);
    if (squad.attackTaskId) {
      console.log(`     攻击任务: ${squad.attackTaskId}`);
    }
    console.log('  ---');
  }
}

// 评估房间攻击难度
export function assessRoom(roomName: string): void {
  // 直接调用全局函数，而不是使用 require
  if (typeof global.assessRoomForAttack === 'function') {
    const assessment = global.assessRoomForAttack(roomName);
    if (!assessment) {
      console.log(`❌ 无法评估房间 ${roomName}`);
      return;
    }

    console.log(`📊 房间 ${roomName} 攻击评估:`);
    console.log(`  威胁等级: ${assessment.threatLevel}`);
    console.log(`  预估防御者: ${assessment.estimatedDefenders}`);
    console.log(`  预估建筑: ${assessment.estimatedStructures}`);
    console.log(`  建议战斗小组: ${assessment.recommendedSquads}`);
    console.log(`  预估能量消耗: ${assessment.energyCost}`);
    console.log(`  成功概率: ${(assessment.successProbability * 100).toFixed(1)}%`);
  } else {
    console.log(`❌ 攻击评估系统未加载，请等待代码部署完成`);
  }
}

// 强制撤退所有攻击任务
export function forceRetreat(): void {
  if (!Memory.attackTasks) {
    console.log('📋 当前没有攻击任务');
    return;
  }

  let retreatedCount = 0;
  for (const taskId in Memory.attackTasks) {
    const task = Memory.attackTasks[taskId];
    if (task.status === 'moving' || task.status === 'engaging') {
      task.status = 'retreating';
      retreatedCount++;
    }
  }

  console.log(`✅ 强制撤退 ${retreatedCount} 个攻击任务`);
}

// 强制更新编组状态
export function forceUpdateSquad(squadId: string): void {
  if (typeof global.forceUpdateSquadStatus === 'function') {
    global.forceUpdateSquadStatus(squadId);
  } else {
    console.log(`❌ 编组状态更新系统未加载`);
  }
}

// 任务管理命令
export function showTasks(roomName?: string): void {
  if (!roomName) {
    roomName = Object.keys(Game.rooms)[0];
  }

  const room = Game.rooms[roomName];
  if (!room) {
    console.log(`房间 ${roomName} 不存在`);
    return;
  }

  const roomMemory = room.memory;
  if (!roomMemory || !roomMemory.tasks) {
    console.log(`房间 ${roomName} 没有任务`);
    return;
  }

  const tasks = roomMemory.tasks;
  const taskCount = Object.keys(tasks).length;

  console.log(`房间 ${roomName} 共有 ${taskCount} 个任务:`);

  Object.values(tasks).forEach((task: any, index: number) => {
    const status = task.status || 'unknown';
    const assignedTo = task.assignedTo || '未分配';
    const type = task.type || 'unknown';
    const priority = task.priority || 'normal';

    console.log(`${index + 1}. [${status}] ${type} (${priority}) - 分配给: ${assignedTo}`);
    if (task.harvesterId) {
      console.log(`   矿工ID: ${task.harvesterId}`);
    }
    if (task.targetId) {
      console.log(`   目标ID: ${task.targetId}`);
    }
  });
}

export function cleanupTasks(roomName?: string): void {
  if (!roomName) {
    roomName = Object.keys(Game.rooms)[0];
  }

  const room = Game.rooms[roomName];
  if (!room) {
    console.log(`房间 ${roomName} 不存在`);
    return;
  }

  try {
    const { getRoomTaskManager } = require('../managers/taskManager');
    const taskManager = getRoomTaskManager(roomName);

    if (taskManager && typeof taskManager.cleanupTasks === 'function') {
      // 调用任务管理器的清理方法
      (taskManager as any).cleanupTasks();
      console.log(`房间 ${roomName} 任务清理完成`);
    } else {
      console.log(`任务管理器不可用`);
    }
  } catch (error) {
    console.log(`清理任务时发生错误: ${error}`);
  }
}

export function forceAssignTasks(roomName?: string): void {
  if (!roomName) {
    roomName = Object.keys(Game.rooms)[0];
  }

  const room = Game.rooms[roomName];
  if (!room) {
    console.log(`房间 ${roomName} 不存在`);
    return;
  }

  try {
    const { getRoomTaskManager } = require('../managers/taskManager');
    const taskManager = getRoomTaskManager(roomName);

    if (taskManager) {
      // 强制扫描房间生成任务
      taskManager.scanRoomForTasks();

      // 尝试为所有搬运工分配任务
      const carriers = room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'carrier'
      });

      let assignedCount = 0;
      carriers.forEach(carrier => {
        const result = taskManager.assignTask(carrier);
        if (result.success) {
          assignedCount++;
          console.log(`搬运工 ${carrier.name} 分配到任务: ${result.task?.type}`);
        }
      });

      console.log(`房间 ${roomName} 强制分配完成，${assignedCount}/${carriers.length} 个搬运工分配到任务`);
    } else {
      console.log(`任务管理器不可用`);
    }
  } catch (error) {
    console.log(`强制分配任务时发生错误: ${error}`);
  }
}

export function showTaskAssignmentStatus(roomName?: string): void {
  if (!roomName) {
    roomName = Object.keys(Game.rooms)[0];
  }

  const room = Game.rooms[roomName];
  if (!room) {
    console.log(`房间 ${roomName} 不存在`);
    return;
  }

  console.log(`=== 房间 ${roomName} 任务分配状态 ===`);

  // 显示搬运工状态
  const carriers = room.find(FIND_MY_CREEPS, {
    filter: (c) => c.memory.role === 'carrier'
  });

  console.log(`\n搬运工状态 (共 ${carriers.length} 个):`);
  carriers.forEach((carrier, index) => {
    const hasTask = carrier.memory.currentTaskId ? '✅' : '❌';
    const isWorking = carrier.memory.working ? '工作中' : '空闲';
    const energy = carrier.store.getUsedCapacity(RESOURCE_ENERGY);
    const capacity = carrier.store.getCapacity(RESOURCE_ENERGY);

    console.log(`  ${index + 1}. ${carrier.name} ${hasTask} 任务: ${carrier.memory.currentTaskId || '无'} | 状态: ${isWorking} | 能量: ${energy}/${capacity}`);
  });

  // 显示任务状态
  const roomMemory = room.memory;
  if (roomMemory && roomMemory.tasks) {
    const tasks = roomMemory.tasks;
    const taskCount = Object.keys(tasks).length;

    console.log(`\n任务状态 (共 ${taskCount} 个):`);

    const pendingTasks = Object.values(tasks).filter((t: any) => t.status === 'pending');
    const assignedTasks = Object.values(tasks).filter((t: any) => t.status === 'assigned');
    const inProgressTasks = Object.values(tasks).filter((t: any) => t.status === 'in_progress');

    console.log(`  待分配: ${pendingTasks.length} | 已分配: ${assignedTasks.length} | 进行中: ${inProgressTasks.length}`);

    if (pendingTasks.length > 0) {
      console.log(`\n待分配任务:`);
      pendingTasks.forEach((task: any, index: number) => {
        console.log(`  ${index + 1}. ${task.type} (${task.priority}) - ${task.id}`);
        if (task.harvesterId) {
          console.log(`     矿工ID: ${task.harvesterId}`);
        }
      });
    }

    if (assignedTasks.length > 0) {
      console.log(`\n已分配任务:`);
      assignedTasks.forEach((task: any, index: number) => {
        const assignedTo = task.assignedTo || '未知';
        console.log(`  ${index + 1}. ${task.type} (${task.priority}) - ${task.id} -> ${assignedTo}`);
      });
    }
  } else {
    console.log(`\n没有任务数据`);
  }
}

// 显示帮助信息
export function help(): void {
  console.log('🎮 攻击系统控制台命令:');
  console.log('  attack(roomName, targetRoom) - 创建攻击任务');
  console.log('  forceAttack(roomName, targetRoom) - 强制攻击（忽略力量限制）');
  console.log('  createSquad(roomName) - 手动创建战斗编组');
  console.log('  refillSquad(squadId) - 手动补充编组人员');
  console.log('  forceUpdateSquad(squadId) - 强制更新编组状态为ready');
  console.log('  showAttackTasks() - 显示攻击任务状态');
  console.log('  cancelAttack(taskId) - 取消攻击任务');
  console.log('  showCombatSquads() - 显示战斗小组状态');
  console.log('  assessRoom(roomName) - 评估房间攻击难度');
  console.log('  forceRetreat() - 强制撤退所有攻击任务');
  console.log('  showTasks(roomName) - 查看房间任务');
  console.log('  cleanupTasks(roomName) - 清理房间过期任务');
  console.log('  forceAssignTasks(roomName) - 强制扫描房间并分配搬运工任务');
  console.log('  showTaskAssignmentStatus(roomName) - 查看房间任务分配状态');
  console.log('  help() - 显示此帮助信息');
  console.log('');
  console.log('💡 使用示例:');
  console.log('  attack("W1N1", "W1N2") - 从W1N1攻击W1N2');
  console.log('  forceAttack("W1N1", "W1N2") - 强制攻击（即使力量不足）');
  console.log('  createSquad("W1N1") - 在W1N1手动创建战斗编组');
  console.log('  refillSquad("squad_123") - 补充编组squad_123的人员');
  console.log('  forceUpdateSquad("squad_123") - 强制更新编组状态');
  console.log('  showAttackTasks() - 查看所有攻击任务');
  console.log('  showCombatSquads() - 查看所有战斗编组');
  console.log('  assessRoom("W1N2") - 评估W1N2的攻击难度');
}
