import { Task } from '../types/tasks';

export class RoleCarrier {
  public static run(creep: Creep): void {
    // 状态切换逻辑
    if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
      creep.memory.working = false;
      creep.say('📦 收集');
      delete creep.memory.targetId;
      delete creep.memory.currentTaskId;
      // 清除徘徊计数器
      delete creep.memory.stuckCounter;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      creep.say('🚚 运输');
      delete creep.memory.targetId;
      delete creep.memory.currentTaskId;
      // 清除徘徊计数器
      delete creep.memory.stuckCounter;
    }

    // 检查是否卡住
    this.checkIfStuck(creep);

    // 从任务列表查找分配给自己的任务
    const myTask = this.findMyTask(creep);
    if (myTask) {
      this.executeTask(creep, myTask);
      return;
    }

    // 没有任务时执行默认行为
    this.executeDefaultBehavior(creep);
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
      return null;
    }

    // 只查房间内存，消除多重数据源
    for (const taskId in roomMemory.tasks) {
      const task = roomMemory.tasks[taskId];
      if (task.assignedTo === creep.id &&
          (task.status === 'assigned' || task.status === 'in_progress')) {

        creep.memory.currentTaskId = task.id;
        return task;
      }
    }

    // 没找到任务，清理过期的currentTaskId
    if (creep.memory.currentTaskId) {
      delete creep.memory.currentTaskId;
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

    // 已经在升级者旁边，pull着升级者往控制器位置前进
    creep.say('🚛 搬运升级者');
    const pullResult = creep.pull(upgrader);

    if (pullResult === OK) {
      // 向控制器位置移动
      const moveResult = creep.moveTo(targetPos, {
        visualizePathStyle: { stroke: '#00ffff' },
        reusePath: 3
      });

      if (moveResult === OK) {
        console.log(`[搬运工${creep.name}] 成功pull升级者向控制器位置移动`);
      } else {
        console.log(`[搬运工${creep.name}] 移动失败: ${moveResult}`);
      }

      return { success: true, shouldContinue: true, message: '正在搬运升级者' };
    } else {
      console.log(`[搬运工${creep.name}] Pull升级者失败: ${pullResult}`);
      return { success: true, shouldContinue: true, message: 'Pull失败，重试中' };
    }
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
  private static executeDefaultBehavior(creep: Creep): void {
    if (creep.memory.working) {
      // 运输模式：转移能量
      this.deliverResources(creep);
    } else {
      // 收集模式：捡起能量
      this.collectResources(creep);
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
      // 没有可收集的资源，原地等待
      creep.say('⏳ 等待');
    }
  }

  // 运输资源 - 简化逻辑
  private static deliverResources(creep: Creep): void {
    let target: Structure | Creep | null = null;

    // 1. 优先运输到 Extension
    const extensions = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType === STRUCTURE_EXTENSION &&
               structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });

    if (extensions.length > 0) {
      target = creep.pos.findClosestByPath(extensions);
      creep.say('🏗️ 填充扩展');
    }

    // 2. 运输到 Spawn
    if (!target) {
      const spawns = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return structure.structureType === STRUCTURE_SPAWN &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (spawns.length > 0) {
        target = creep.pos.findClosestByPath(spawns);
        creep.say('🏰 填充主城');
      }
    }

    // 3. 运输到升级者
    if (!target) {
      const upgraders = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.memory.role === 'upgrader' &&
                       c.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });

      if (upgraders.length > 0) {
        target = creep.pos.findClosestByPath(upgraders);
        creep.say('⚡ 帮助升级者');
      }
    }

    // 4. 运输到容器
    if (!target) {
      const containers = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType === STRUCTURE_CONTAINER ||
                  structure.structureType === STRUCTURE_STORAGE) &&
                 structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (containers.length > 0) {
        target = creep.pos.findClosestByPath(containers);
        creep.say('📦 填充容器');
      }
    }

    // 执行运输
    if (target) {
      let result: number;

      if (target instanceof Creep) {
        result = creep.transfer(target, RESOURCE_ENERGY);
      } else {
        result = creep.transfer(target, RESOURCE_ENERGY);
      }

      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {
          visualizePathStyle: { stroke: '#ffffff' }
        });
      } else if (result === OK) {
        if (target instanceof Creep) {
          creep.say('⚡');
        } else {
          creep.say('🚚');
        }
      } else if (result === ERR_FULL) {
        // 当前目标已满，寻找备用存储目标
        creep.say('🔄 找备用');
        this.handleFullStorage(creep);
      }
    } else {
      // 如果没有运输目标，原地等待
      creep.say('⏳ 等待');
    }
  }

  // 处理存储目标已满的情况
  private static handleFullStorage(creep: Creep): void {
    // 寻找备用存储目标，按优先级排序
    const alternativeTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return (structure.structureType === STRUCTURE_SPAWN ||
                structure.structureType === STRUCTURE_EXTENSION ||
                structure.structureType === STRUCTURE_TOWER ||
                structure.structureType === STRUCTURE_CONTAINER ||
                structure.structureType === STRUCTURE_STORAGE) &&
               structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });

    // 按优先级对目标排序：Spawn > Extension > Tower > Container > Storage
    alternativeTargets.sort((a, b) => {
      const priorityOrder: { [key: string]: number } = {
        [STRUCTURE_SPAWN]: 1,
        [STRUCTURE_EXTENSION]: 2,
        [STRUCTURE_TOWER]: 3,
        [STRUCTURE_CONTAINER]: 4,
        [STRUCTURE_STORAGE]: 5
      };
      const priorityA = priorityOrder[a.structureType] || 999;
      const priorityB = priorityOrder[b.structureType] || 999;
      return priorityA - priorityB;
    });

    if (alternativeTargets.length > 0) {
      // 找到最近的高优先级目标
      const nearestTarget = creep.pos.findClosestByPath(alternativeTargets);
      if (nearestTarget) {
        const transferResult = creep.transfer(nearestTarget, RESOURCE_ENERGY);
        if (transferResult === OK) {
          creep.say('💾 转存');
          console.log(`[搬运工${creep.name}] 转存到备用目标: ${nearestTarget.structureType}`);
        } else if (transferResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(nearestTarget, {
            visualizePathStyle: { stroke: '#00ff00' }
          });
          creep.say('🚶 去备用');
        } else if (transferResult === ERR_FULL) {
          // 如果备用目标也满了，递归寻找下一个
          console.log(`[搬运工${creep.name}] 备用目标也满了，寻找下一个`);
          // 移除已满的目标后重试
          const nextTargets = alternativeTargets.filter(t => t.id !== nearestTarget.id);
          if (nextTargets.length > 0) {
            const nextTarget = creep.pos.findClosestByPath(nextTargets);
            if (nextTarget && creep.pos.isNearTo(nextTarget)) {
              const nextResult = creep.transfer(nextTarget, RESOURCE_ENERGY);
              if (nextResult === OK) {
                creep.say('💾 次选');
              }
            } else if (nextTarget) {
              creep.moveTo(nextTarget);
              creep.say('🚶 次选');
            }
          }
        }
      }
    } else {
      // 没有备用存储，暂时等待
      creep.say('⏳ 无存储');
      console.log(`[搬运工${creep.name}] 所有存储都满了，等待中`);
    }
  }

  // 执行供应能量任务（spawn/extension）
  private static executeSupplyEnergyTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    // 如果没有能量，先去获取
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      return this.getEnergyFromBestSource(creep);
    }

    // 获取目标建筑
    const target = Game.getObjectById(task.targetId);
    if (!target) {
      console.log(`[搬运工${creep.name}] 供应目标不存在: ${task.targetId}`);
      return { success: false, shouldContinue: false, message: '供应目标不存在' };
    }

    // 检查目标是否还需要能量
    if ((target as any).store?.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      console.log(`[搬运工${creep.name}] 供应目标已满: ${task.targetId}`);
      return { success: true, shouldContinue: false, message: '供应目标已满' };
    }

    // 移动到目标并传输能量
    const transferResult = creep.transfer(target as Structure, RESOURCE_ENERGY);
    if (transferResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(target as Structure);
      creep.say('🚚 去供应');
      return { success: true, shouldContinue: true, message: '前往供应目标' };
    } else if (transferResult === OK) {
      creep.say('⚡ 供应');
      console.log(`[搬运工${creep.name}] 成功供应能量到 ${(target as Structure).structureType}`);
      return { success: true, shouldContinue: false, message: '供应完成' };
    } else {
      console.log(`[搬运工${creep.name}] 供应失败: ${transferResult}`);
      return { success: false, shouldContinue: false, message: '供应失败' };
    }
  }

  // 执行配送到spawn任务
  private static executeDeliverToSpawnTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    // 如果没有能量，先去获取
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      return this.getEnergyFromBestSource(creep);
    }

    // 获取spawn
    const spawn = Game.getObjectById(task.spawnId);
    if (!spawn) {
      console.log(`[搬运工${creep.name}] spawn不存在: ${task.spawnId}`);
      return { success: false, shouldContinue: false, message: 'spawn不存在' };
    }

    // 检查spawn是否还需要能量
    if ((spawn as StructureSpawn).store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
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

  // 执行配送给creep任务
  private static executeDeliverToCreepTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    // 如果没有能量，先去获取
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      return this.getEnergyFromBestSource(creep);
    }

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

  // 从最佳来源获取能量
  private static getEnergyFromBestSource(creep: Creep): { success: boolean; shouldContinue: boolean; message?: string } {
    // 优先从容器获取能量
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: structure => (structure.structureType === STRUCTURE_CONTAINER ||
                           structure.structureType === STRUCTURE_STORAGE) &&
                          structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });

    if (containers.length > 0) {
      const nearestContainer = creep.pos.findClosestByPath(containers);
      if (nearestContainer) {
        const withdrawResult = creep.withdraw(nearestContainer, RESOURCE_ENERGY);
        if (withdrawResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(nearestContainer);
          creep.say('📦 取能量');
          return { success: true, shouldContinue: true, message: '前往能量来源' };
        } else if (withdrawResult === OK) {
          creep.say('📦 获取');
          return { success: true, shouldContinue: true, message: '获取能量成功' };
        }
      }
    }

    // 如果没有容器，从掉落资源获取
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: resource => resource.resourceType === RESOURCE_ENERGY
    });

    if (droppedEnergy.length > 0) {
      const nearestEnergy = creep.pos.findClosestByPath(droppedEnergy);
      if (nearestEnergy) {
        const pickupResult = creep.pickup(nearestEnergy);
        if (pickupResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(nearestEnergy);
          creep.say('📦 捡能量');
          return { success: true, shouldContinue: true, message: '前往掉落能量' };
        } else if (pickupResult === OK) {
          creep.say('📦 捡取');
          return { success: true, shouldContinue: true, message: '捡取能量成功' };
        }
      }
    }

    // 没有可用能量来源
    console.log(`[搬运工${creep.name}] 没有找到可用的能量来源`);
    return { success: false, shouldContinue: false, message: '没有能量来源' };
  }
}

