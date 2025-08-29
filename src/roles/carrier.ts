import { TaskSystem, TaskType } from '../managers/taskSystem';

// 真正的蜂群思维：纯粹的任务执行器
// 原则：不做任何状态判断，只执行分配的任务
export class RoleCarrier {
  public static run(creep: Creep): void {
    // 获取当前分配的任务
    const currentTask = TaskSystem.getCreepTask(creep);
    
    if (currentTask) {
      // 纯粹执行任务 - 无脑模式
      this.executeTaskPurely(creep, currentTask);
    } else {
      // 没有任务时就待机
      creep.say('💤 待机');
    }
  }

  // 纯粹任务执行 - 消除所有状态判断
  private static executeTaskPurely(creep: Creep, task: any): void {
    switch (task.type) {
      // 供应类任务
      case TaskType.SUPPLY_SPAWN:
      case TaskType.SUPPLY_EXTENSION:
        this.executeTransferTask(creep, task);
        break;
      
      // 协助类任务  
      case TaskType.ASSIST_HARVESTER:
      case TaskType.ASSIST_UPGRADER:
        this.executeTransportTask(creep, task);
        break;
      
      // 配送类任务
      case TaskType.SUPPLY_BUILDER:
      case TaskType.SUPPLY_UPGRADER:
        this.executeDeliveryTask(creep, task);
        break;
      
      // 收集类任务
      case TaskType.COLLECT_ENERGY:
        this.executeCollectTask(creep, task);
        break;
      case TaskType.WITHDRAW_ENERGY:
        this.executeWithdrawTask(creep, task);
        break;
      
      // 存储类任务
      case TaskType.STORE_ENERGY:
        this.executeStoreTask(creep, task);
        break;
      
      // 维护类任务
      case TaskType.CLEAR_TOMBSTONE:
      case TaskType.CLEAR_RUIN:
        this.executeClearTask(creep, task);
        break;
        
      default:
        console.log(`[搬运工${creep.name}] 未知任务类型: ${task.type}`);
        TaskSystem.completeTask(creep);
        break;
    }
  }

  // 转移任务：给spawn/extension转移能量
  private static executeTransferTask(creep: Creep, task: any): void {
    const target = Game.getObjectById(task.targetId);
    if (!target) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 无脑执行：如果没有能量就失败，如果有能量就转移
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      console.log(`[搬运工${creep.name}] 任务失败：没有能量`);
      TaskSystem.completeTask(creep);
      return;
    }

    const result = creep.transfer(target as any, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target as any);
      creep.say('🚚 去转移');
    } else if (result === OK) {
      creep.say('⚡ 转移');
      TaskSystem.completeTask(creep);
    } else {
      TaskSystem.completeTask(creep);
    }
  }

  // 搬运任务：搬运静态工人
  private static executeTransportTask(creep: Creep, task: any): void {
    const targetCreep = Game.getObjectById(task.targetId);
    if (!targetCreep) {
      TaskSystem.completeTask(creep);
      return;
    }

    const targetPos = task.targetPos;
    
    // 如果目标已在位置，任务完成
    if ((targetCreep as Creep).pos.isEqualTo(targetPos)) {
      ((targetCreep as Creep).memory as any).working = true;
      TaskSystem.completeTask(creep);
      return;
    }

    // 移动到目标旁边
    if (!creep.pos.isNearTo(targetCreep as Creep)) {
      creep.moveTo(targetCreep as Creep);
      creep.say('🚶 接近');
      return;
    }

    // 拉着目标到指定位置
    const pullResult = creep.pull(targetCreep as Creep);
    if (pullResult === OK) {
      creep.moveTo(targetPos);
      creep.say('🚛 搬运');
    }
  }

  // 收集任务：收集指定资源
  private static executeCollectTask(creep: Creep, task: any): void {
    const resource = Game.getObjectById(task.targetId);
    if (!resource) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 无脑执行：如果背包满了就失败，否则收集
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      console.log(`[搬运工${creep.name}] 任务失败：背包已满`);
      TaskSystem.completeTask(creep);
      return;
    }

    const result = creep.pickup(resource as Resource);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(resource as Resource);
      creep.say('🚶 去收集');
    } else if (result === OK) {
      creep.say('📦 收集');
      TaskSystem.completeTask(creep);
    } else {
      TaskSystem.completeTask(creep);
    }
  }

  // 配送任务：给其他creep配送能量
  private static executeDeliveryTask(creep: Creep, task: any): void {
    const targetCreep = Game.getObjectById(task.targetId);
    if (!targetCreep) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 无脑执行：如果没有能量就失败，如果有能量就配送
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      console.log(`[搬运工${creep.name}] 任务失败：没有能量`);
      TaskSystem.completeTask(creep);
      return;
    }

    const result = creep.transfer(targetCreep as Creep, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(targetCreep as Creep);
      creep.say('🚚 去配送');
    } else if (result === OK) {
      creep.say('⚡ 配送');
      TaskSystem.completeTask(creep);
    } else {
      TaskSystem.completeTask(creep);
    }
  }

  // 取能量任务：从container/storage取能量
  private static executeWithdrawTask(creep: Creep, task: any): void {
    const target = Game.getObjectById(task.targetId);
    if (!target) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 无脑执行：如果背包满了就失败，否则取能量
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      console.log(`[搬运工${creep.name}] 任务失败：背包已满`);
      TaskSystem.completeTask(creep);
      return;
    }

    const result = creep.withdraw(target as any, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target as any);
      creep.say('📦 去取');
    } else if (result === OK) {
      creep.say('📦 取能');
      TaskSystem.completeTask(creep);
    } else {
      TaskSystem.completeTask(creep);
    }
  }

  // 存储任务：存储能量到container/storage
  private static executeStoreTask(creep: Creep, task: any): void {
    const target = Game.getObjectById(task.targetId);
    if (!target) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 无脑执行：如果没有能量就失败，如果有能量就存储
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      console.log(`[搬运工${creep.name}] 任务失败：没有能量`);
      TaskSystem.completeTask(creep);
      return;
    }

    const result = creep.transfer(target as any, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target as any);
      creep.say('💾 去存');
    } else if (result === OK) {
      creep.say('💾 存储');
      TaskSystem.completeTask(creep);
    } else {
      TaskSystem.completeTask(creep);
    }
  }

  // 清理任务：清理墓碑/废墟
  private static executeClearTask(creep: Creep, task: any): void {
    const target = Game.getObjectById(task.targetId);
    if (!target) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 无脑执行：如果背包满了就失败，否则清理
    if (creep.store.getFreeCapacity() === 0) {
      console.log(`[搬运工${creep.name}] 任务失败：背包已满`);
      TaskSystem.completeTask(creep);
      return;
    }

    // 墓碑和废墟都用withdraw方法
    const result = creep.withdraw(target as any, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target as any);
      creep.say('🧹 去清理');
    } else if (result === OK) {
      creep.say('🧹 清理');
      TaskSystem.completeTask(creep);
    } else {
      TaskSystem.completeTask(creep);
    }
  }
}