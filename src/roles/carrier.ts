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

    // 查找assignedTo字段为自己名字的任务
    for (const taskId in roomMemory.tasks) {
      const task = roomMemory.tasks[taskId];
      if (task.assignedTo === creep.name &&
          (task.status === 'assigned' || task.status === 'in_progress')) {
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
    }

    // 清除搬运工的任务ID
    delete creep.memory.currentTaskId;
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

