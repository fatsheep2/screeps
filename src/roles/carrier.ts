import { TaskExecutor } from '../executors/taskExecutor';
import { Task } from '../types/tasks';

export class RoleCarrier {
  public static run(creep: Creep): void {
    // 状态切换逻辑
    if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
      creep.memory.working = false;
      creep.say('📦 收集');
      delete creep.memory.targetId;
      delete creep.memory.currentTaskId;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      creep.say('🚚 运输');
      delete creep.memory.targetId;
      delete creep.memory.currentTaskId;
    }

    // 从任务列表查找分配给自己的任务
    const myTask = this.findMyTask(creep);
    if (myTask) {
      this.executeTask(creep, myTask);
      return;
    }

    // 没有任务时执行默认行为
    this.executeDefaultBehavior(creep);
  }

  // 查找分配给自己的任务
  private static findMyTask(creep: Creep): Task | null {
    const roomMemory = Memory.rooms[creep.room.name];
    if (!roomMemory || !roomMemory.tasks) {
      return null;
    }

    // 查找assignedTo字段为自己名字或ID的任务
    for (const taskId in roomMemory.tasks) {
      const task = roomMemory.tasks[taskId];
      if ((task.assignedTo === creep.name || task.assignedTo === creep.id) &&
          (task.status === 'assigned' || task.status === 'in_progress')) {

        // 确保 currentTaskId 正确设置
        if (creep.memory.currentTaskId !== task.id) {
          creep.memory.currentTaskId = task.id;
          console.log(`[搬运工${creep.name}] 设置 currentTaskId: ${task.id}`);
        }

        return task;
      }
    }

    // 如果没有找到任务，尝试通过任务管理器查找
    try {
      const { getRoomTaskManager } = require('../managers/taskManager');
      const taskManager = getRoomTaskManager(creep.room.name);
      if (taskManager && typeof taskManager.getCreepTask === 'function') {
        const managerTask = taskManager.getCreepTask(creep.id);
        if (managerTask) {
          // 确保 currentTaskId 正确设置
          if (creep.memory.currentTaskId !== managerTask.id) {
            creep.memory.currentTaskId = managerTask.id;
            console.log(`[搬运工${creep.name}] 通过任务管理器设置 currentTaskId: ${managerTask.id}`);
          }

          return managerTask;
        }
      }
    } catch (error) {
      // 忽略错误，继续使用内存中的任务
    }

    return null;
  }





    // 执行任务
  private static executeTask(creep: Creep, task: Task): void {
    console.log(`[搬运工${creep.name}] 执行任务: ${task.type} - ${task.id}`);

    if (task.type === 'assistStaticHarvester') {
      const result = this.executeTransportTask(creep, task);
      if (!result.shouldContinue) {
        // 任务完成，清理任务
        this.completeTask(creep, task);
      }
    } else if (task.type === 'collectEnergy') {
      const result = this.executeCollectEnergyTask(creep, task);
      if (!result.shouldContinue) {
        // 任务完成，清理任务
        this.completeTask(creep, task);
      }
    } else if (task.type === 'transferEnergy') {
      const result = this.executeTransferEnergyTask(creep, task);
      if (!result.shouldContinue) {
        // 任务完成，清理任务
        this.completeTask(creep, task);
      }
    } else {
      // 其他任务交给TaskExecutor处理
      const result = TaskExecutor.executeTask(creep, task);
      if (!result.shouldContinue) {
        // 任务完成，清理任务
        this.completeTask(creep, task);
      }
    }
  }

  // 完成任务
  private static completeTask(creep: Creep, task: Task): void {
    console.log(`[搬运工${creep.name}] 任务完成: ${task.id}`);

    // 从房间任务中删除
    const roomMemory = Memory.rooms[creep.room.name];
    if (roomMemory && roomMemory.tasks) {
      delete roomMemory.tasks[task.id];
      console.log(`[搬运工${creep.name}] 从房间内存中删除任务: ${task.id}`);
    }

    // 清除搬运工的任务ID
    delete creep.memory.currentTaskId;

    // 通知任务管理器任务已完成
    try {
      const { getRoomTaskManager } = require('../managers/taskManager');
      const taskManager = getRoomTaskManager(creep.room.name);
      if (taskManager && typeof taskManager.completeTask === 'function') {
        taskManager.completeTask(task.id);
        console.log(`[搬运工${creep.name}] 通知任务管理器任务完成: ${task.id}`);
      }
    } catch (error) {
      console.log(`[搬运工${creep.name}] 通知任务管理器失败: ${error}`);
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

    // 已经到达任务地点，并且矿工在身边，直接和矿工对调位置
    if (harvester.pos.isNearTo(creep.pos)) {
      // 先pull矿工，然后搬运工移动到矿工的位置
      creep.say('🔄 对调位置');
      const pullResult = creep.pull(harvester);

      if (pullResult === OK) {
        // 搬运工移动到矿工的位置，矿工通过pull机制到达目标位置
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

  // 执行收集能量任务
  private static executeCollectEnergyTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    console.log(`[搬运工${creep.name}] 执行收集能量任务: ${task.id}`);

    // 如果背包满了，去存储能量
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      return this.storeCollectedEnergy(creep, task);
    }

    // 获取能量目标
    const energyTarget = Game.getObjectById(task.targetId);
    if (!energyTarget) {
      console.log(`[搬运工${creep.name}] 能量目标不存在: ${task.targetId}`);
      return { success: false, shouldContinue: false, message: '能量目标不存在' };
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
      console.log(`[搬运工${creep.name}] 成功收集能量`);
    } else {
      console.log(`[搬运工${creep.name}] 收集能量失败: ${collectResult}`);
    }

    return { success: true, shouldContinue: true, message: '正在收集能量' };
  }

  // 存储收集到的能量
  private static storeCollectedEnergy(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    // 获取存储目标
    const storageTarget = Game.getObjectById(task.storageTargetId);
    if (!storageTarget) {
      console.log(`[搬运工${creep.name}] 存储目标不存在: ${task.storageTargetId}`);
      return { success: false, shouldContinue: false, message: '存储目标不存在' };
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
    } else {
      console.log(`[搬运工${creep.name}] 存储能量失败: ${transferResult}`);
    }

    return { success: true, shouldContinue: true, message: '正在存储能量' };
  }

  // 执行转移能量任务
  private static executeTransferEnergyTask(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    console.log(`[搬运工${creep.name}] 执行转移能量任务: ${task.id}`);

    // 如果背包空了，去获取能量
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      return this.getEnergyForTransfer(creep, task);
    }

    // 获取转移目标
    const transferTarget = Game.getObjectById(task.targetId);
    if (!transferTarget) {
      console.log(`[搬运工${creep.name}] 转移目标不存在: ${task.targetId}`);
      return { success: false, shouldContinue: false, message: '转移目标不存在' };
    }

    // 如果不在转移目标附近，移动到目标
    const transferPos = (transferTarget as any).pos;
    if (!creep.pos.isNearTo(transferPos)) {
      creep.moveTo(transferPos, { reusePath: 3 });
      creep.say('🚚 去转移');
      return { success: true, shouldContinue: true, message: '正在前往转移目标' };
    }

    // 在转移目标附近，开始转移能量
    const transferResult = creep.transfer(transferTarget as Structure, RESOURCE_ENERGY);
    if (transferResult === OK) {
      creep.say('💾 转移');
      console.log(`[搬运工${creep.name}] 成功转移能量到 ${transferTarget.id}`);

      // 如果目标满了或者背包空了，任务完成
      if ((transferTarget as any).store?.getFreeCapacity(RESOURCE_ENERGY) === 0 ||
          creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        return { success: true, shouldContinue: false, message: '转移任务完成' };
      }
    } else {
      console.log(`[搬运工${creep.name}] 转移能量失败: ${transferResult}`);
    }

    return { success: true, shouldContinue: true, message: '正在转移能量' };
  }

  // 为转移任务获取能量
  private static getEnergyForTransfer(creep: Creep, task: any): { success: boolean; shouldContinue: boolean; message?: string } {
    // 获取能量来源
    const energySource = Game.getObjectById(task.sourceId);
    if (!energySource) {
      console.log(`[搬运工${creep.name}] 能量来源不存在: ${task.sourceId}`);
      return { success: false, shouldContinue: false, message: '能量来源不存在' };
    }

    // 如果不在能量来源附近，移动到来源
    const sourcePos = (energySource as any).pos;
    if (!creep.pos.isNearTo(sourcePos)) {
      creep.moveTo(sourcePos, { reusePath: 3 });
      creep.say('📦 去获取');
      return { success: true, shouldContinue: true, message: '正在前往能量来源' };
    }

    // 在能量来源附近，开始获取能量
    let withdrawResult: number;
    if (task.sourceType === 'dropped') {
      withdrawResult = creep.pickup(energySource as Resource);
    } else {
      withdrawResult = creep.withdraw(energySource as Structure, RESOURCE_ENERGY);
    }

    if (withdrawResult === OK) {
      creep.say('📦 获取');
      console.log(`[搬运工${creep.name}] 成功获取能量`);
    } else {
      console.log(`[搬运工${creep.name}] 获取能量失败: ${withdrawResult}`);
    }

    return { success: true, shouldContinue: true, message: '正在获取能量' };
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
      }
    } else {
      // 如果没有运输目标，原地等待
      creep.say('⏳ 等待');
    }
  }
}

