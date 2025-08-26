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

  // 使用 critical 优先级强制创建攻击任务
  if (typeof global.manualAttack === 'function') {
    // 这里需要修改 manualAttack 函数以支持 critical 优先级
    console.log(`🚨 强制攻击模式：${roomName} → ${targetRoom}`);
    console.log(`⚠️ 注意：即使战斗力量不足也会执行攻击`);

    // 临时降低评估要求
    const originalConfig = global.ATTACK_ASSESSMENT_CONFIG;
    if (originalConfig) {
      // 临时调整配置
      global.ATTACK_ASSESSMENT_CONFIG = {
        ...originalConfig,
        SQUAD_CALCULATION: {
          ...originalConfig.SQUAD_CALCULATION,
          DIVISOR: 4, // 降低要求（原来是2）
          MAX_SQUADS: 2 // 降低最大小组数
        }
      };

      const taskId = global.manualAttack(room, targetRoom);

      // 恢复原始配置
      global.ATTACK_ASSESSMENT_CONFIG = originalConfig;

      if (taskId) {
        console.log(`✅ 强制攻击任务创建成功: ${taskId}`);
      } else {
        console.log(`❌ 强制攻击任务创建失败`);
      }
    } else {
      console.log(`❌ 无法调整攻击配置`);
    }
  } else {
    console.log(`❌ 攻击系统未加载`);
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

// 显示帮助信息
export function help(): void {
  console.log('🎮 攻击系统控制台命令:');
  console.log('  attack(roomName, targetRoom) - 创建攻击任务');
  console.log('  forceAttack(roomName, targetRoom) - 强制攻击（忽略力量限制）');
  console.log('  showAttackTasks() - 显示攻击任务状态');
  console.log('  cancelAttack(taskId) - 取消攻击任务');
  console.log('  showCombatSquads() - 显示战斗小组状态');
  console.log('  assessRoom(roomName) - 评估房间攻击难度');
  console.log('  forceRetreat() - 强制撤退所有攻击任务');
  console.log('  help() - 显示此帮助信息');
  console.log('');
  console.log('💡 使用示例:');
  console.log('  attack("W1N1", "W1N2") - 从W1N1攻击W1N2');
  console.log('  forceAttack("W1N1", "W1N2") - 强制攻击（即使力量不足）');
  console.log('  showAttackTasks() - 查看所有攻击任务');
  console.log('  assessRoom("W1N2") - 评估W1N2的攻击难度');
}
