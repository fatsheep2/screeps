import { Task } from '../types/tasks';
import { TaskBatchingManager } from '../managers/taskBatchingManager';

export class RoleCarrier {
  public static run(creep: Creep): void {
    // 智能任务优先级管理：解决死锁问题
    const currentEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY);

    // 检查是否卡住
    this.checkIfStuck(creep);

    // 优先处理批处理任务
    if (creep.memory.currentTaskBatch && creep.memory.currentTaskBatch.length > 0) {
      this.executeBatchTasks(creep);
      return;
    }

    // 从任务列表查找分配给自己的任务
    const myTask = this.findMyTask(creep);
    if (myTask) {
      // 最高优先级：搬运任务（不需要能量，避免死锁）
      if (this.isTransportTask(myTask)) {
        console.log(`[搬运工${creep.name}] 执行高优先级搬运任务: ${myTask.type}`);
        this.executeTask(creep, myTask);
        return;
      }

      // 中等优先级：能量消耗任务（需要检查能量）
      if (this.isEnergyConsumingTask(myTask)) {
        const requiredEnergy = (myTask as any).requiredAmount || 50;
        if (currentEnergy >= requiredEnergy) {
          this.executeTask(creep, myTask);
          return;
        } else {
          // 能量不足，检查是否有能量源可以收集
          const hasEnergySource = this.checkForEnergySource(creep);

          if (hasEnergySource) {
            // 有能量源，去收集能量
            console.log(`[搬运工${creep.name}] 任务需要${requiredEnergy}能量，当前只有${currentEnergy}，先去收集`);
            this.collectResourcesForTask(creep, requiredEnergy - currentEnergy);
            return;
          } else {
            // 没有能量源，检查是否有更紧急的搬运任务
            const urgentTransportTask = this.findUrgentTransportTask(creep);
            if (urgentTransportTask) {
              console.log(`[搬运工${creep.name}] 没有能量源，释放当前任务${myTask.id}，转去执行紧急搬运任务${urgentTransportTask.id}`);
              this.releaseCurrentTask(creep, myTask);
              this.assignTask(creep, urgentTransportTask);
              this.executeTask(creep, urgentTransportTask);
              return;
            } else {
              // 没有紧急搬运任务，尝试收集能量（可能会等待）
              console.log(`[搬运工${creep.name}] 没有能量源也没有紧急搬运任务，尝试收集能量`);
              this.collectResourcesForTask(creep, requiredEnergy - currentEnergy);
              return;
            }
          }
        }
      }

      // 其他任务类型，直接执行
      console.log(`[搬运工${creep.name}] 执行其他任务: ${myTask.type}`);
      this.executeTask(creep, myTask);
      return;
    }

    // 没有任务时，尝试获取批处理任务
    const batchTasks = TaskBatchingManager.createBatchedTask(creep, creep.room);
    if (batchTasks.length > 1) {
      TaskBatchingManager.assignBatchToCarrier(creep, batchTasks, creep.room);
      creep.say('📋 批处理');
      return;
    } else if (batchTasks.length === 1) {
      // 单个任务，正常分配
      const task = batchTasks[0];
      const roomMemory = Memory.rooms[creep.room.name];
      if (roomMemory && roomMemory.tasks) {
        task.assignedTo = creep.id;
        task.assignedAt = Game.time;
        task.status = 'assigned';
        creep.memory.currentTaskId = task.id;
        roomMemory.tasks[task.id] = task;
      }
      return;
    }

    // 没有批处理任务时，根据能量状态决定行为
    if (currentEnergy > 0) {
      // 有能量但没有任务，检查是否需要存储到storage
      const storage = creep.room.storage;

      if (!storage) {
        // 没有storage，待机
        creep.say('⏸️ 无storage');
        return;
      }

      const storageEnergyRatio = storage.store.getUsedCapacity(RESOURCE_ENERGY) / storage.store.getCapacity(RESOURCE_ENERGY);

      // 检查是否有紧急需求（spawn/extension缺能量）
      const urgentStructures = creep.room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType === STRUCTURE_SPAWN ||
                  structure.structureType === STRUCTURE_EXTENSION) &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (urgentStructures.length > 0) {
        // 有紧急需求，优先补充spawn/extension
        const target = creep.pos.findClosestByRange(urgentStructures);
        if (target) {
          this.transferToTarget(creep, target as StructureSpawn | StructureExtension, '🚨 紧急补能');
          return;
        }
      }

      // 提高storage存储阈值，避免频繁操作
      if (storageEnergyRatio < 0.7 && currentEnergy >= creep.store.getCapacity() * 0.8) {
        // 只有当storage确实需要能量且搬运工携带足够能量时才存储
        this.storeToStorage(creep);
        return;
      } else {
        // 否则待机，避免无意义的转移
        creep.say('💤 待机');
        return;
      }
    } else {
      // 没有能量时，限制检查频率避免无意义操作
      if (Game.time % 3 === 0 && this.checkForEnergySource(creep)) {
        this.collectResources(creep);
        return;
      } else {
        // 没有能量源，检查紧急搬运任务
        const urgentTask = this.findUrgentTransportTask(creep);
        if (urgentTask) {
          this.assignTask(creep, urgentTask);
          this.executeTask(creep, urgentTask);
          return;
        } else {
          // 真的没事做，待机
          creep.say('⏸️ 待机');
          return;
        }
      }
    }
  }

  // 检查搬运工是否卡住
  private static checkIfStuck(creep: Creep): void {
    if (!creep.memory.lastPos) {
      creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y, tick: Game.time };
      return;
    }

    const lastPos = creep.memory.lastPos;
    const currentTick = Game.time;

    // 如果位置相同且超过5个tick，认为卡住了
    if (lastPos.x === creep.pos.x && lastPos.y === creep.pos.y && (currentTick - lastPos.tick) > 5) {
      if (!creep.memory.stuckCounter) {
        creep.memory.stuckCounter = 1;
      } else {
        creep.memory.stuckCounter++;
      }

      console.log(`[搬运工${creep.name}] 可能卡住了，徘徊次数: ${creep.memory.stuckCounter}`);

      // 如果卡住超过3次，尝试随机移动
      if (creep.memory.stuckCounter > 3) {
        const randomDirection = (Math.floor(Math.random() * 8) + 1) as DirectionConstant;
        creep.move(randomDirection);
        creep.say('🔄 随机移动');
        console.log(`[搬运工${creep.name}] 执行随机移动，方向: ${randomDirection}`);

        // 重置徘徊计数器
        delete creep.memory.stuckCounter;
      }
    } else if (lastPos.x !== creep.pos.x || lastPos.y !== creep.pos.y) {
      // 位置发生变化，重置徘徊计数器
      delete creep.memory.stuckCounter;
    }

    // 更新位置记录
    creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y, tick: Game.time };
  }

  // 查找分配给自己的任务 - 简化为单一数据源
  private static findMyTask(creep: Creep): Task | null {
    const roomMemory = Memory.rooms[creep.room.name];
    if (!roomMemory || !roomMemory.tasks) {
      // 清理过期的currentTaskId
      if (creep.memory.currentTaskId) {
        console.log(`[搬运工${creep.name}] 房间任务系统不存在，清理currentTaskId: ${creep.memory.currentTaskId}`);
        delete creep.memory.currentTaskId;
      }
      return null;
    }

    // 首先检查当前分配的任务是否还存在
    if (creep.memory.currentTaskId) {
      const currentTask = roomMemory.tasks[creep.memory.currentTaskId];
      if (!currentTask) {
        // 当前任务已被删除，清理currentTaskId
        console.log(`[搬运工${creep.name}] 当前任务已被删除，清理currentTaskId: ${creep.memory.currentTaskId}`);
        delete creep.memory.currentTaskId;
      } else if (currentTask.assignedTo === creep.id &&
                 (currentTask.status === 'assigned' || currentTask.status === 'in_progress')) {
        // 当前任务仍然有效
        return currentTask;
      } else {
        // 任务状态或分配已改变，清理currentTaskId
        console.log(`[搬运工${creep.name}] 任务状态已改变，清理currentTaskId: ${creep.memory.currentTaskId}`);
        delete creep.memory.currentTaskId;
      }
    }

    // 查找新分配的任务
    for (const taskId in roomMemory.tasks) {
      const task = roomMemory.tasks[taskId];
      if (task.assignedTo === creep.id &&
          (task.status === 'assigned' || task.status === 'in_progress')) {

        creep.memory.currentTaskId = task.id;
        console.log(`[搬运工${creep.name}] 发现新任务: ${task.id}`);
        return task;
      }
    }

    return null;
  }





    // 执行任务
  private static executeTask(creep: Creep, task: Task): void {
    console.log(`[搬运工${creep.name}] 执行任务: ${task.type} - ${task.id}`);

    if (task.type === 'assistStaticHarvester') {
      const result = this.executeTransportTask(creep, task);
      if (!result.shouldContinue) {
        this.completeTask(creep, task);
      }
    } else if (task.type === 'assistStaticUpgrader') {
      const result = this.executeUpgraderTransportTask(creep, task);
      if (!result.shouldContinue) {
        this.completeTask(creep, task);
      }
    } else if ((task as any).type === 'assistRemoteHarvester') {
      const result = this.executeRemoteHarvesterTransportTask(creep, task);
      if (!result.shouldContinue) {
        this.completeTask(creep, task);
      }
    } else if (task.type === 'collectEnergy') {
      const result = this.executeCollectEnergyTask(creep, task);
      if (!result.shouldContinue) {
        this.completeTask(creep, task);
      }
    } else if (task.type === 'supplyEnergy') {
      const result = this.executeSupplyEnergyTask(creep, task);
      if (!result.shouldContinue) {
        this.completeTask(creep, task);
      }
    } else if (task.type === 'deliverToSpawn') {
      const result = this.executeDeliverToSpawnTask(creep, task);
      if (!result.shouldContinue) {
        this.completeTask(creep, task);
      }
    } else if (task.type === 'deliverToCreep') {
      const result = this.executeDeliverToCreepTask(creep, task);
      if (!result.shouldContinue) {
        this.completeTask(creep, task);
      }
    } else {
      // 未知任务类型，标记为失败
      console.log(`[搬运工${creep.name}] 未知任务类型: ${task.type}`);
      this.completeTask(creep, task);
    }
  }

  // 执行批处理任务
  private static executeBatchTasks(creep: Creep): void {
    if (!creep.memory.currentTaskBatch || creep.memory.currentTaskBatch.length === 0) {
      return;
    }

    const currentIndex = creep.memory.currentTaskIndex || 0;
    const taskId = creep.memory.currentTaskBatch[currentIndex];
    const roomMemory = Memory.rooms[creep.room.name];

    if (!roomMemory || !roomMemory.tasks || !roomMemory.tasks[taskId]) {
      // 任务不存在，跳到下一个
      this.nextBatchTask(creep);
      return;
    }

    const task = roomMemory.tasks[taskId];
    console.log(`[搬运工${creep.name}] 执行批处理任务 ${currentIndex + 1}/${creep.memory.currentTaskBatch.length}: ${task.type} - ${task.id}`);

    // 执行当前任务
    let result = { shouldContinue: true };

    if (task.type === 'collectEnergy') {
      result = this.executeCollectEnergyTask(creep, task);
    } else if (task.type === 'supplyEnergy') {
      result = this.executeSupplyEnergyTask(creep, task);
    } else if (task.type === 'deliverToSpawn') {
      result = this.executeDeliverToSpawnTask(creep, task);
    } else if (task.type === 'deliverToCreep') {
      result = this.executeDeliverToCreepTask(creep, task);
    } else {
      console.log(`[搬运工${creep.name}] 批处理中未支持的任务类型: ${task.type}`);
      result.shouldContinue = false;
    }

    // 如果当前任务完成，进入下一个任务
    if (!result.shouldContinue) {
      task.status = 'completed';
      roomMemory.tasks[taskId] = task;
      this.nextBatchTask(creep);
    }
  }

  // 进入下一个批处理任务
  private static nextBatchTask(creep: Creep): void {
    if (!creep.memory.currentTaskBatch) return;

    const currentIndex = creep.memory.currentTaskIndex || 0;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= creep.memory.currentTaskBatch.length) {
      // 所有批处理任务完成
      console.log(`[搬运工${creep.name}] 完成所有批处理任务 (${creep.memory.currentTaskBatch.length}个)`);
      delete creep.memory.currentTaskBatch;
      delete creep.memory.currentTaskIndex;
      delete creep.memory.targetId;
      creep.say('✅ 批完成');
    } else {
      // 进入下一个任务
      creep.memory.currentTaskIndex = nextIndex;
      delete creep.memory.targetId; // 清除目标，让下个任务重新寻找
      console.log(`[搬运工${creep.name}] 进入批处理任务 ${nextIndex + 1}/${creep.memory.currentTaskBatch.length}`);
    }
  }

  // 完成任务 - 简化为单一操作
  private static completeTask(creep: Creep, task: Task): void {
    console.log(`[搬运工${creep.name}] 任务完成: ${task.id}`);

    // 只操作房间内存，消除多重同步
    const roomMemory = Memory.rooms[creep.room.name];
    if (roomMemory && roomMemory.tasks) {
      delete roomMemory.tasks[task.id];
    }

    delete creep.memory.currentTaskId;

    // 清理相关内存
    if (task.type === 'collectEnergy') {
      // 对于收集任务，检查是否还有能量需要收集
      const energyTarget = Game.getObjectById(task.targetId);
      if (energyTarget) {
        let remainingEnergy = 0;
        if (task.targetType === 'dropped') {
          remainingEnergy = (energyTarget as Resource).amount;
        } else if (task.targetType === 'tombstone' || task.targetType === 'ruin') {
          remainingEnergy = (energyTarget as any).store?.getUsedCapacity(RESOURCE_ENERGY) || 0;
        } else {
          remainingEnergy = (energyTarget as any).store?.getUsedCapacity(RESOURCE_ENERGY) || 0;
        }

        // 如果还有能量，重新创建任务
        if (remainingEnergy > 0) {
          console.log(`[搬运工${creep.name}] 目标还有 ${remainingEnergy} 能量，重新创建任务`);
          // 这里可以调用任务管理器重新创建任务
          // 暂时先不实现，避免循环创建任务
        }
      }
    }
  }

    // 执行搬运任务
  private static executeTransportTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    const harvester = Game.getObjectById(task.harvesterId) as Creep;
    if (!harvester) {
      console.log(`[搬运工${creep.name}] 静态矿工不存在: ${task.harvesterId}`);
      return { success: false, shouldContinue: false, message: '静态矿工不存在' };
    }

    const targetPos = new RoomPosition(task.targetPosition.x, task.targetPosition.y, creep.room.name);

    // 如果还没到达目标地点，先到矿工旁边
    if (!creep.pos.isEqualTo(targetPos)) {
      // 如果矿工不在身边，先走到矿工旁边
      if (!creep.pos.isNearTo(harvester.pos)) {
        creep.moveTo(harvester.pos, {
          visualizePathStyle: { stroke: '#ffaa00' },
          reusePath: 3
        });
        creep.say('🚶 走向矿工');
        return { success: true, shouldContinue: true, message: '正在走向矿工' };
      }

      // 已经在矿工旁边，pull着矿工往任务地点前进
      creep.say('🚛 搬运中');
      const pullResult = creep.pull(harvester);

      if (pullResult === OK) {
        // 向目标地点移动
        const moveResult = creep.moveTo(targetPos, {
          visualizePathStyle: { stroke: '#ffaa00' },
          reusePath: 3
        });
        console.log(`[搬运工${creep.name}] pull结果: ${pullResult}, 移动结果: ${moveResult}`);
      } else {
        console.log(`[搬运工${creep.name}] pull失败: ${pullResult}`);
      }

      return { success: true, shouldContinue: true, message: '正在搬运矿工' };
    }

    // 已经到达任务地点，并且矿工在身边，对换位置
    if (harvester.pos.isNearTo(creep.pos)) {
      creep.say('🔄 对调位置');
      const pullResult = creep.pull(harvester);

      if (pullResult === OK) {
        // 搬运工移动到矿工位置，矿工被pull到搬运工原位置（目标位置）
        const moveResult = creep.moveTo(harvester.pos, { reusePath: 3 });
        console.log(`[搬运工${creep.name}] 对调位置，pull结果: ${pullResult}, 移动结果: ${moveResult}`);

        // 检查矿工是否已经到达目标位置
        if (harvester.pos.isEqualTo(targetPos)) {
          harvester.memory.working = true;
          console.log(`[搬运工${creep.name}] 搬运任务完成，矿工${harvester.name}已就位`);
          return { success: true, shouldContinue: false, message: '搬运任务完成' };
        }
      } else {
        console.log(`[搬运工${creep.name}] 对调位置时pull失败: ${pullResult}`);
      }

      return { success: true, shouldContinue: true, message: '正在对调位置' };
    }

    // 到达目标地点但矿工不在身边，回到矿工身边
    creep.say('🔄 回到矿工身边');
    creep.moveTo(harvester.pos, {
      visualizePathStyle: { stroke: '#ffaa00' },
      reusePath: 3
    });

    return { success: true, shouldContinue: true, message: '正在回到矿工身边' };
  }

  // 执行升级者搬运任务
  private static executeUpgraderTransportTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    const upgrader = Game.getObjectById(task.upgraderId) as Creep;
    if (!upgrader) {
      console.log(`[搬运工${creep.name}] 静态升级者不存在: ${task.upgraderId}`);
      return { success: false, shouldContinue: false, message: '静态升级者不存在' };
    }

    const targetPos = new RoomPosition(task.targetPosition.x, task.targetPosition.y, creep.room.name);

    // 如果升级者已经在目标位置，任务完成
    if (upgrader.pos.isEqualTo(targetPos)) {
      upgrader.memory.working = true;
      console.log(`[搬运工${creep.name}] 升级者搬运任务完成，${upgrader.name}已就位`);
      return { success: true, shouldContinue: false, message: '升级者搬运任务完成' };
    }

    // 如果还没到达升级者位置，先到升级者旁边
    if (!creep.pos.isNearTo(upgrader.pos)) {
      creep.moveTo(upgrader.pos, {
        visualizePathStyle: { stroke: '#00ffff' },
        reusePath: 3
      });
      creep.say('🚶 走向升级者');
      return { success: true, shouldContinue: true, message: '正在走向升级者' };
    }

    // 如果还没到达目标地点，先pull着升级者往目标地点前进
    if (!creep.pos.isEqualTo(targetPos)) {
      creep.say('🚛 搬运升级者');
      const pullResult = creep.pull(upgrader);

      if (pullResult === OK) {
        // 向目标地点移动
        const moveResult = creep.moveTo(targetPos, {
          visualizePathStyle: { stroke: '#00ffff' },
          reusePath: 3
        });
        console.log(`[搬运工${creep.name}] pull结果: ${pullResult}, 移动结果: ${moveResult}`);
      } else {
        console.log(`[搬运工${creep.name}] pull失败: ${pullResult}`);
      }

      return { success: true, shouldContinue: true, message: '正在搬运升级者' };
    }

    // 已经到达任务地点，并且升级者在身边，对换位置
    if (upgrader.pos.isNearTo(creep.pos)) {
      creep.say('🔄 对调位置');
      const pullResult = creep.pull(upgrader);

      if (pullResult === OK) {
        // 搬运工移动到升级者位置，升级者被pull到搬运工原位置（目标位置）
        const moveResult = creep.moveTo(upgrader.pos, { reusePath: 3 });
        console.log(`[搬运工${creep.name}] 对调位置，pull结果: ${pullResult}, 移动结果: ${moveResult}`);

        // 检查升级者是否已经到达目标位置
        if (upgrader.pos.isEqualTo(targetPos)) {
          upgrader.memory.working = true;
          console.log(`[搬运工${creep.name}] 搬运任务完成，升级者${upgrader.name}已就位`);
          return { success: true, shouldContinue: false, message: '搬运任务完成' };
        }
      } else {
        console.log(`[搬运工${creep.name}] 对调位置时pull失败: ${pullResult}`);
      }

      return { success: true, shouldContinue: true, message: '正在对调位置' };
    }

    // 到达目标地点但升级者不在身边，回到升级者身边
    creep.say('🔄 回到升级者身边');
    creep.moveTo(upgrader.pos, {
      visualizePathStyle: { stroke: '#00ffff' },
      reusePath: 3
    });

    return { success: true, shouldContinue: true, message: '正在回到升级者身边' };
  }

  // 执行收集能量任务
  private static executeCollectEnergyTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    console.log(`[搬运工${creep.name}] 执行收集能量任务: ${task.id}`);

    // 如果背包满了，去存储能量
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      console.log(`[搬运工${creep.name}] 背包已满，开始存储能量`);
      return this.storeCollectedEnergy(creep, task);
    }

    // 获取能量目标
    const energyTarget = Game.getObjectById(task.targetId);
    if (!energyTarget) {
      console.log(`[搬运工${creep.name}] 能量目标不存在: ${task.targetId}`);
      return { success: false, shouldContinue: false, message: '能量目标不存在' };
    }

    // 检查能量目标是否还有能量
    let hasEnergy = false;
    if (task.targetType === 'dropped') {
      hasEnergy = (energyTarget as Resource).amount > 0;
    } else if (task.targetType === 'tombstone' || task.targetType === 'ruin') {
      hasEnergy = (energyTarget as any).store?.getUsedCapacity(RESOURCE_ENERGY) > 0;
    } else {
      hasEnergy = (energyTarget as any).store?.getUsedCapacity(RESOURCE_ENERGY) > 0;
    }

    if (!hasEnergy) {
      console.log(`[搬运工${creep.name}] 能量目标已空，任务完成`);
      return { success: true, shouldContinue: false, message: '能量目标已空' };
    }

    // 如果不在目标附近，移动到目标
    const targetPos = (energyTarget as any).pos;
    if (!creep.pos.isNearTo(targetPos)) {
      creep.moveTo(targetPos, { reusePath: 3 });
      creep.say('🚶 走向能量');
      return { success: true, shouldContinue: true, message: '正在走向能量目标' };
    }

    // 在目标附近，开始收集
    let collectResult: number;
    if (task.targetType === 'dropped') {
      collectResult = creep.pickup(energyTarget as Resource);
    } else if (task.targetType === 'tombstone') {
      collectResult = creep.withdraw(energyTarget as Tombstone, RESOURCE_ENERGY);
    } else if (task.targetType === 'ruin') {
      collectResult = creep.withdraw(energyTarget as Ruin, RESOURCE_ENERGY);
    } else {
      collectResult = creep.withdraw(energyTarget as Structure, RESOURCE_ENERGY);
    }

    if (collectResult === OK) {
      creep.say('📦 收集');
      console.log(`[搬运工${creep.name}] 成功收集能量，当前背包: ${creep.store.getUsedCapacity(RESOURCE_ENERGY)}/${creep.store.getCapacity()}`);
    } else {
      console.log(`[搬运工${creep.name}] 收集能量失败: ${collectResult}`);
    }

    return { success: true, shouldContinue: true, message: '正在收集能量' };
  }

  // 存储收集到的能量
  private static storeCollectedEnergy(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    // 获取存储目标
    let storageTarget = Game.getObjectById(task.storageTargetId);

    // 如果主要存储目标不存在或已满，寻找新的存储目标
    if (!storageTarget || (storageTarget as any).store?.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      creep.say('🔄 找新存储');

      // 优先寻找主要存储建筑（container, storage）
      const primaryTargets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType === STRUCTURE_CONTAINER ||
                  structure.structureType === STRUCTURE_STORAGE) &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      // 如果没有主要存储建筑，寻找次要存储建筑
      const secondaryTargets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType === STRUCTURE_SPAWN ||
                  structure.structureType === STRUCTURE_EXTENSION ||
                  structure.structureType === STRUCTURE_TOWER) &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      // 按优先级选择目标
      let newTarget = null;
      if (primaryTargets.length > 0) {
        newTarget = creep.pos.findClosestByPath(primaryTargets);
      } else if (secondaryTargets.length > 0) {
        newTarget = creep.pos.findClosestByPath(secondaryTargets);
      }

      if (newTarget) {
        // 更新任务的存储目标
        task.storageTargetId = newTarget.id;
        storageTarget = newTarget;

        // 更新房间内存中的任务
        const roomMemory = Memory.rooms[creep.room.name];
        if (roomMemory && roomMemory.tasks && roomMemory.tasks[task.id]) {
          roomMemory.tasks[task.id].storageTargetId = newTarget.id;
        }

        console.log(`[搬运工${creep.name}] 更新存储目标为: ${newTarget.structureType} ${newTarget.id}`);
      } else {
        console.log(`[搬运工${creep.name}] 没有可用的存储目标`);
        return { success: false, shouldContinue: false, message: '没有可用的存储目标' };
      }
    }

    // 如果不在存储目标附近，移动到目标
    const storagePos = (storageTarget as any).pos;
    if (!creep.pos.isNearTo(storagePos)) {
      creep.moveTo(storagePos, { reusePath: 3 });
      creep.say('🚚 去存储');
      return { success: true, shouldContinue: true, message: '正在前往存储目标' };
    }

    // 在存储目标附近，开始转移能量
    const transferResult = creep.transfer(storageTarget as Structure, RESOURCE_ENERGY);
    if (transferResult === OK) {
      creep.say('💾 存储');
      console.log(`[搬运工${creep.name}] 成功存储能量到 ${storageTarget.id}`);

      // 如果背包空了，任务完成
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        return { success: true, shouldContinue: false, message: '收集任务完成' };
      }
    } else if (transferResult === ERR_FULL) {
      // 存储目标已满，标记为需要寻找新目标，下次执行时会重新寻找
      console.log(`[搬运工${creep.name}] 存储目标已满: ${storageTarget.id}`);
      // 清除当前存储目标，下次执行时会重新寻找
      delete task.storageTargetId;

      // 更新房间内存中的任务
      const roomMemory = Memory.rooms[creep.room.name];
      if (roomMemory && roomMemory.tasks && roomMemory.tasks[task.id]) {
        delete roomMemory.tasks[task.id].storageTargetId;
      }

      return { success: true, shouldContinue: true, message: '存储目标已满，下次重新寻找' };
    } else {
      console.log(`[搬运工${creep.name}] 存储能量失败: ${transferResult}`);
    }

    return { success: true, shouldContinue: true, message: '正在存储能量' };
  }


  // 执行默认行为（收集或运输能量）
    // 检查是否为搬运任务（最高优先级，不需要能量）
  private static isTransportTask(task: any): boolean {
    return task.type === 'assistStaticHarvester' ||
           task.type === 'assistStaticUpgrader' ||
           task.type === 'assistRemoteHarvester';
  }

  // 检查是否为能量消耗任务
  private static isEnergyConsumingTask(task: any): boolean {
    return task.type === 'supplyEnergy' ||
           task.type === 'deliverToSpawn' ||
           task.type === 'deliverToCreep';
  }

  // 检查是否有能量源可用
  private static checkForEnergySource(creep: Creep): boolean {
    // 检查地上的能量
    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (resource) => resource.resourceType === RESOURCE_ENERGY
    });
    if (droppedResources.length > 0) return true;

    // 检查墓碑
    const tombstones = creep.room.find(FIND_TOMBSTONES, {
      filter: (tombstone) => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (tombstones.length > 0) return true;

    // 检查废墟
    const ruins = creep.room.find(FIND_RUINS, {
      filter: (ruin) => ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (ruins.length > 0) return true;

    // 检查容器和储存
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return (structure.structureType === STRUCTURE_CONTAINER ||
                structure.structureType === STRUCTURE_STORAGE) &&
               structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
      }
    });

    return containers.length > 0;
  }

  // 寻找紧急的搬运任务
  private static findUrgentTransportTask(creep: Creep): any | null {
    const roomMemory = Memory.rooms[creep.room.name];
    if (!roomMemory || !roomMemory.tasks) return null;

    // 寻找pending状态的搬运任务（优先级：urgent）
    const urgentTasks = Object.values(roomMemory.tasks).filter((task: any) =>
      (task.type === 'assistStaticHarvester' || task.type === 'assistStaticUpgrader' || task.type === 'assistRemoteHarvester') &&
      task.status === 'pending' &&
      task.priority === 'urgent'
    );

    return urgentTasks.length > 0 ? urgentTasks[0] : null;
  }

  // 释放当前任务
  private static releaseCurrentTask(creep: Creep, task: any): void {
    const roomMemory = Memory.rooms[creep.room.name];
    if (roomMemory && roomMemory.tasks && roomMemory.tasks[task.id]) {
      // 重置任务状态
      roomMemory.tasks[task.id].status = 'pending';
      roomMemory.tasks[task.id].assignedTo = null;
      roomMemory.tasks[task.id].assignedAt = null;

      console.log(`[搬运工${creep.name}] 释放任务: ${task.id}`);
    }

    // 清除creep的任务记忆
    delete creep.memory.currentTaskId;
  }

  // 分配任务给搬运工
  private static assignTask(creep: Creep, task: any): void {
    const roomMemory = Memory.rooms[creep.room.name];
    if (roomMemory && roomMemory.tasks && roomMemory.tasks[task.id]) {
      // 分配任务
      roomMemory.tasks[task.id].status = 'assigned';
      roomMemory.tasks[task.id].assignedTo = creep.id;
      roomMemory.tasks[task.id].assignedAt = Game.time;

      // 设置creep的任务记忆
      creep.memory.currentTaskId = task.id;

      console.log(`[搬运工${creep.name}] 分配任务: ${task.id}`);
    }
  }

  // 为特定任务收集足够的能量
  private static collectResourcesForTask(creep: Creep, neededAmount: number): void {
    creep.say(`💰 需${neededAmount}`);
    this.getEnergyFromContainer(creep, neededAmount);
  }

  // 存储到storage
  private static storeToStorage(creep: Creep): void {
    const storage = creep.room.storage;
    if (!storage) {
      // 没有storage，找container
      const containers = creep.room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });

      if (containers.length > 0) {
        const target = creep.pos.findClosestByPath(containers);
        if (target) {
          this.transferToTarget(creep, target, '📦 存容器');
          return;
        }
      }

      // 没有存储位置，待机
      creep.say('⏸️ 待机');
      return;
    }

    if (storage.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      creep.say('🏪 仓库满');
      return;
    }

    this.transferToTarget(creep, storage, '🏪 存仓库');
  }

  // 统一的转移逻辑
  private static transferToTarget(creep: Creep, target: Structure, message: string): void {
    const transferResult = creep.transfer(target, RESOURCE_ENERGY);

    if (transferResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(target);
      creep.say(message);
    } else if (transferResult === OK) {
      creep.say('✅ 完成');
      console.log(`[搬运工${creep.name}] 成功存储${creep.store.getUsedCapacity(RESOURCE_ENERGY)}能量到${target.structureType}`);
    } else {
      console.log(`[搬运工${creep.name}] 存储失败: ${transferResult}`);
    }
  }

  // 收集资源 - 简化逻辑
  private static collectResources(creep: Creep): void {
    let target: Resource | Structure | Tombstone | Ruin | null = null;

    // 1. 优先收集地上的能量
    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (resource) => resource.resourceType === RESOURCE_ENERGY
    });

    if (droppedResources.length > 0) {
      target = creep.pos.findClosestByPath(droppedResources);
    }

    // 2. 从墓碑收集能量
    if (!target) {
      const tombstones = creep.room.find(FIND_TOMBSTONES, {
        filter: (tombstone) => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      });

      if (tombstones.length > 0) {
        target = creep.pos.findClosestByPath(tombstones);
      }
    }

    // 3. 从废墟收集能量
    if (!target) {
      const ruins = creep.room.find(FIND_RUINS, {
        filter: (ruin) => ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      });

      if (ruins.length > 0) {
        target = creep.pos.findClosestByPath(ruins);
      }
    }

    // 4. 从容器收集能量
    if (!target) {
      const containers = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType === STRUCTURE_CONTAINER ||
                  structure.structureType === STRUCTURE_STORAGE) &&
                 structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (containers.length > 0) {
        target = creep.pos.findClosestByPath(containers);
      }
    }

    // 执行收集
    if (target) {
      let result: number;

      if (target instanceof Resource) {
        result = creep.pickup(target);
      } else if (target instanceof Ruin) {
        result = creep.withdraw(target, RESOURCE_ENERGY);
      } else {
        result = creep.withdraw(target, RESOURCE_ENERGY);
      }

      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {
          visualizePathStyle: { stroke: '#ffaa00' }
        });
      } else if (result === OK) {
        creep.say('📦');
      }
    } else {
      // 没有可收集的资源，检查是否有矿工需要搬运
      console.log(`[搬运工${creep.name}] 没有能量源，检查是否有搬运任务`);

      // 在没有能量源的情况下，仍然可以执行搬运任务来启动经济
      const transportTasks = Object.values(creep.room.memory.tasks || {}).filter((task: any) =>
        (task.type === 'assistStaticHarvester' || task.type === 'assistStaticUpgrader' || task.type === 'assistRemoteHarvester') &&
        task.status === 'pending'
      );

      if (transportTasks.length > 0) {
        creep.say('🚚 找搬运');
        console.log(`[搬运工${creep.name}] 发现${transportTasks.length}个待处理搬运任务，等待分配`);
      } else {
        creep.say('⏳ 无能量源');
        console.log(`[搬运工${creep.name}] 没有能量源且没有搬运任务，等待中`);
      }
    }
  }

  // 已删除deliverResources方法 - 现在只通过任务系统管理能量传输，不再主动寻找升级者

  // 执行供应能量任务（spawn/extension） - 简化版：假设已检查能量充足
  private static executeSupplyEnergyTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    const currentEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY);

    // 获取目标建筑
    const target = Game.getObjectById(task.targetId);
    if (!target) {
      console.log(`[搬运工${creep.name}] 供应目标不存在: ${task.targetId}`);
      return { success: false, shouldContinue: false, message: '供应目标不存在' };
    }

    // 检查目标是否还需要能量
    const targetNeed = (target as any).store?.getFreeCapacity(RESOURCE_ENERGY) || 0;
    if (targetNeed === 0) {
      console.log(`[搬运工${creep.name}] 供应目标已满: ${task.targetId}`);
      return { success: true, shouldContinue: false, message: '供应目标已满' };
    }

    // 直接传输能量（调用此方法前已确保有足够能量）
    const transferAmount = Math.min(currentEnergy, targetNeed);
    const transferResult = creep.transfer(target as Structure, RESOURCE_ENERGY, transferAmount);

    if (transferResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(target as Structure);
      creep.say('🚚 去供应');
      return { success: true, shouldContinue: true, message: '前往供应目标' };
    } else if (transferResult === OK) {
      creep.say('⚡ 供应');
      console.log(`[搬运工${creep.name}] 成功供应${transferAmount}能量到 ${(target as Structure).structureType}`);
      return { success: true, shouldContinue: false, message: '供应完成' };
    } else {
      console.log(`[搬运工${creep.name}] 供应失败: ${transferResult}`);
      return { success: false, shouldContinue: false, message: '供应失败' };
    }
  }

  // 执行配送到spawn任务 - 简化版：假设已检查能量充足
  private static executeDeliverToSpawnTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {

    // 获取spawn
    const spawn = Game.getObjectById(task.spawnId);
    if (!spawn) {
      console.log(`[搬运工${creep.name}] spawn不存在: ${task.spawnId}`);
      return { success: false, shouldContinue: false, message: 'spawn不存在' };
    }

    // 检查spawn是否还需要能量
    const spawnNeed = (spawn as StructureSpawn).store.getFreeCapacity(RESOURCE_ENERGY);
    if (spawnNeed === 0) {
      console.log(`[搬运工${creep.name}] spawn已满: ${task.spawnId}`);
      return { success: true, shouldContinue: false, message: 'spawn已满' };
    }

    // 移动到spawn并传输能量
    const transferResult = creep.transfer(spawn as StructureSpawn, RESOURCE_ENERGY);
    if (transferResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(spawn as StructureSpawn);
      creep.say('🚚 去spawn');
      return { success: true, shouldContinue: true, message: '前往spawn' };
    } else if (transferResult === OK) {
      creep.say('🏰 填充');
      console.log(`[搬运工${creep.name}] 成功填充spawn`);
      return { success: true, shouldContinue: false, message: 'spawn填充完成' };
    } else {
      console.log(`[搬运工${creep.name}] spawn填充失败: ${transferResult}`);
      return { success: false, shouldContinue: false, message: 'spawn填充失败' };
    }
  }

  // 执行配送给creep任务 - 简化版：假设已检查能量充足
  private static executeDeliverToCreepTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {

    // 获取目标creep
    const targetCreep = Game.getObjectById(task.creepId);
    if (!targetCreep) {
      console.log(`[搬运工${creep.name}] 目标creep不存在: ${task.creepId}`);
      return { success: false, shouldContinue: false, message: '目标creep不存在' };
    }

    // 验证请求者ID确保任务有效性
    if (task.requesterId !== targetCreep.id) {
      console.log(`[搬运工${creep.name}] 任务请求者ID不匹配: ${task.requesterId} != ${targetCreep.id}`);
      return { success: false, shouldContinue: false, message: '请求者ID不匹配' };
    }

    // 检查creep是否还需要能量
    if ((targetCreep as Creep).store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      console.log(`[搬运工${creep.name}] 目标creep已满: ${task.creepId}`);
      return { success: true, shouldContinue: false, message: '目标creep已满' };
    }

    // 移动到目标creep并传输能量
    const transferResult = creep.transfer(targetCreep as Creep, RESOURCE_ENERGY);
    if (transferResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(targetCreep as Creep);
      creep.say('🚚 去配送');
      return { success: true, shouldContinue: true, message: '前往目标creep' };
    } else if (transferResult === OK) {
      creep.say('⚡ 配送');
      console.log(`[搬运工${creep.name}] 成功配送能量给 ${(targetCreep as Creep).name}`);
      return { success: true, shouldContinue: false, message: 'creep配送完成' };
    } else {
      console.log(`[搬运工${creep.name}] creep配送失败: ${transferResult}`);
      return { success: false, shouldContinue: false, message: 'creep配送失败' };
    }
  }

  // 从容器获取特定数量的能量
  private static getEnergyFromContainer(creep: Creep, neededAmount: number): { success: boolean; shouldContinue: boolean; message?: string } {
    let target: Structure | null = null;

    // 1. 首先从满载或接近满载的Container获取（防止overflow）
    const nearFullContainers = creep.room.find(FIND_STRUCTURES, {
      filter: structure => structure.structureType === STRUCTURE_CONTAINER &&
                          (structure as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) >
                          (structure as StructureContainer).store.getCapacity() * 0.8
    }) as StructureContainer[];

    if (nearFullContainers.length > 0) {
      // 优先选择最满的，再考虑距离
      const sortedContainers = nearFullContainers.sort((a, b) => {
        const aFullness = a.store.getUsedCapacity(RESOURCE_ENERGY) / a.store.getCapacity();
        const bFullness = b.store.getUsedCapacity(RESOURCE_ENERGY) / b.store.getCapacity();
        return bFullness - aFullness; // 满载程度高的优先
      });
      target = creep.pos.findClosestByPath(sortedContainers.slice(0, 3)); // 从前3个最满的中选最近的
      if (target) {
        creep.say('📦 防溢出');
      }
    }

    // 2. 其次从有足够能量的Container获取
    if (!target) {
      const containers = creep.room.find(FIND_STRUCTURES, {
        filter: structure => structure.structureType === STRUCTURE_CONTAINER &&
                            structure.store.getUsedCapacity(RESOURCE_ENERGY) >= neededAmount
      });

      if (containers.length > 0) {
        target = creep.pos.findClosestByPath(containers);
        if (target) {
          creep.say('📦 足量容器');
        }
      }
    }

    // 3. 再从任何有能量的Container获取（container优先于storage）
    if (!target) {
      const anyContainers = creep.room.find(FIND_STRUCTURES, {
        filter: structure => structure.structureType === STRUCTURE_CONTAINER &&
                            structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      });

      if (anyContainers.length > 0) {
        target = creep.pos.findClosestByPath(anyContainers);
        if (target) {
          creep.say('📦 任意容器');
        }
      }
    }

    // 4. 最后才从Storage获取（优先级最低）
    if (!target) {
      const storage = creep.room.storage;
      if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        target = storage;
        creep.say('🏪 仓库获取');
      }
    }

    if (!target) {
      creep.say('❌ 无能量源');
      console.log(`[搬运工${creep.name}] 房间内没有足够的能量源`);
      return { success: false, shouldContinue: false, message: '没有能量源' };
    }

    // 移动到目标并获取能量
    const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
    if (withdrawResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(target);
      creep.say('🏃 去取能量');
      return { success: true, shouldContinue: true, message: '前往能量源' };
    } else if (withdrawResult === OK) {
      creep.say('⚡ 取能量');
      console.log(`[搬运工${creep.name}] 成功从${target.structureType}获取能量`);
      return { success: true, shouldContinue: true, message: '获取能量成功' };
    } else {
      console.log(`[搬运工${creep.name}] 获取能量失败: ${withdrawResult}`);
      return { success: false, shouldContinue: false, message: '获取能量失败' };
    }
  }

  // 从最佳来源获取能量
  // private static getEnergyFromBestSource(creep: Creep): { success: boolean; shouldContinue: boolean; message?: string } {
  //   // 优先从容器获取能量
  //   const containers = creep.room.find(FIND_STRUCTURES, {
  //     filter: structure => (structure.structureType === STRUCTURE_CONTAINER ||
  //                          structure.structureType === STRUCTURE_STORAGE) &&
  //                         structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0
  //   });

  //   if (containers.length > 0) {
  //     const nearestContainer = creep.pos.findClosestByPath(containers);
  //     if (nearestContainer) {
  //       const withdrawResult = creep.withdraw(nearestContainer, RESOURCE_ENERGY);
  //       if (withdrawResult === ERR_NOT_IN_RANGE) {
  //         creep.moveTo(nearestContainer);
  //         creep.say('📦 取能量');
  //         return { success: true, shouldContinue: true, message: '前往能量来源' };
  //       } else if (withdrawResult === OK) {
  //         creep.say('📦 获取');
  //         return { success: true, shouldContinue: true, message: '获取能量成功' };
  //       }
  //     }
  //   }

  //   // 如果没有容器，从掉落资源获取
  //   const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
  //     filter: resource => resource.resourceType === RESOURCE_ENERGY
  //   });

  //   if (droppedEnergy.length > 0) {
  //     const nearestEnergy = creep.pos.findClosestByPath(droppedEnergy);
  //     if (nearestEnergy) {
  //       const pickupResult = creep.pickup(nearestEnergy);
  //       if (pickupResult === ERR_NOT_IN_RANGE) {
  //         creep.moveTo(nearestEnergy);
  //         creep.say('📦 捡能量');
  //         return { success: true, shouldContinue: true, message: '前往掉落能量' };
  //       } else if (pickupResult === OK) {
  //         creep.say('📦 捡取');
  //         return { success: true, shouldContinue: true, message: '捡取能量成功' };
  //       }
  //     }
  //   }

  //   // 没有可用能量来源
  //   console.log(`[搬运工${creep.name}] 没有找到可用的能量来源`);
  //   return { success: false, shouldContinue: false, message: '没有能量来源' };
  // }

  // 执行外矿搬运任务
  private static executeRemoteHarvesterTransportTask(creep: Creep, task: any): { shouldContinue: boolean } {
    const targetRoomName = task.targetRoom;

    // 如果不在目标房间，先移动到目标房间
    if (creep.room.name !== targetRoomName) {
      const exitDir = creep.room.findExitTo(targetRoomName);
      if (exitDir === ERR_NO_PATH || exitDir === ERR_INVALID_ARGS) {
        console.log(`[搬运工${creep.name}] 无法找到前往外矿房间${targetRoomName}的路径`);
        return { shouldContinue: false };
      }

      const exit = creep.pos.findClosestByPath(exitDir);
      if (exit) {
        creep.moveTo(exit);
        creep.say(`➡️ ${targetRoomName}`);
      }
      return { shouldContinue: true };
    }

    // 在目标房间，检查是否需要生成外矿矿工
    const source = Game.getObjectById(task.sourceId);

    if (!source) {
      console.log(`[搬运工${creep.name}] 外矿能源点${task.sourceId}不存在`);
      return { shouldContinue: false };
    }

    // 检查矿点附近是否有本方的静态矿工
    const nearbyHarvesters = (source as Source).pos.findInRange(FIND_MY_CREEPS, 1, {
      filter: (c) => c.memory.role === 'staticHarvester' && c.memory.sourceIndex === task.sourceIndex
    });

    if (nearbyHarvesters.length === 0) {
      // 需要生成或搬运外矿矿工
      console.log(`[搬运工${creep.name}] 外矿房间${targetRoomName}矿点${task.sourceIndex}需要矿工`);

      // 在主房间寻找空闲的静态矿工
      const homeRoom = Game.rooms[task.homeRoom];
      if (homeRoom) {
        const idleHarvesters = homeRoom.find(FIND_MY_CREEPS, {
          filter: (c) => c.memory.role === 'staticHarvester' && !c.memory.targetId
        });

        if (idleHarvesters.length > 0) {
          const harvester = idleHarvesters[0];
          // 分配外矿任务给矿工
          harvester.memory.targetId = source.id;
          harvester.memory.sourceIndex = task.sourceIndex;
          console.log(`[搬运工${creep.name}] 分配外矿任务给矿工${harvester.name}`);
        }
      }

      return { shouldContinue: true };
    }

    // 矿工已就位，检查是否需要搬运能量
    const nearbyContainers = (source as Source).pos.findInRange(FIND_STRUCTURES, 2, {
      filter: (structure) => structure.structureType === STRUCTURE_CONTAINER
    });

    if (nearbyContainers.length > 0) {
      const container = nearbyContainers[0] as StructureContainer;

      // 如果容器有能量且搬运工空载，收集能量
      if (container.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && creep.store.getFreeCapacity() > 0) {
        if (creep.pos.getRangeTo(container) > 1) {
          creep.moveTo(container);
          creep.say('🚛 去收集');
          return { shouldContinue: true };
        } else {
          const withdrawResult = creep.withdraw(container, RESOURCE_ENERGY);
          if (withdrawResult === OK) {
            creep.say('⚡ 收集');
          }
          return { shouldContinue: true };
        }
      }

      // 如果搬运工满载，返回主房间存储
      if (creep.store.getFreeCapacity() === 0) {
        // 移动到主房间进行存储
        if (creep.room.name !== task.homeRoom) {
          const exitDir = creep.room.findExitTo(task.homeRoom);
          if (exitDir !== ERR_NO_PATH && exitDir !== ERR_INVALID_ARGS) {
            const exit = creep.pos.findClosestByPath(exitDir);
            if (exit) {
              creep.moveTo(exit);
              creep.say(`⬅️ 回家`);
            }
          }
          return { shouldContinue: true };
        } else {
          // 在主房间，存储到storage或spawn
          const storage = creep.room.storage;
          if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.pos.getRangeTo(storage) > 1) {
              creep.moveTo(storage);
            } else {
              creep.transfer(storage, RESOURCE_ENERGY);
              creep.say('🏪 存储');
            }
          } else {
            // 找到需要能量的建筑
            const targets = creep.room.find(FIND_STRUCTURES, {
              filter: (structure) => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN) &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
              }
            });

            if (targets.length > 0) {
              const target = creep.pos.findClosestByPath(targets);
              if (target) {
                if (creep.pos.getRangeTo(target) > 1) {
                  creep.moveTo(target);
                } else {
                  creep.transfer(target, RESOURCE_ENERGY);
                  creep.say('⚡ 供能');
                }
              }
            }
          }
          return { shouldContinue: true };
        }
      }
    }

    // 检查地上是否有掉落的能量
    const droppedEnergy = (source as Source).pos.findInRange(FIND_DROPPED_RESOURCES, 2, {
      filter: (resource) => resource.resourceType === RESOURCE_ENERGY
    });

    if (droppedEnergy.length > 0 && creep.store.getFreeCapacity() > 0) {
      const resource = droppedEnergy[0];
      if (creep.pos.getRangeTo(resource) > 1) {
        creep.moveTo(resource);
        creep.say('🚛 去捡');
      } else {
        creep.pickup(resource);
        creep.say('📦 捡取');
      }
      return { shouldContinue: true };
    }

    // 外矿运营正常，任务持续进行
    return { shouldContinue: true };
  }
}

