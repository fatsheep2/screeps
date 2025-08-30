import { TaskSystem, TaskType } from '../managers/taskSystem';

// 蜂群搬运工 - 纯粹的任务执行器
export class RoleCarrier {
  public static run(creep: Creep): void {
    const task = TaskSystem.getCreepTask(creep);
    
    if (task) {
      this.executeTask(creep, task);
    } else {
      creep.say('💤 待机');
    }
  }

  private static executeTask(creep: Creep, task: any): void {
    switch (task.type) {
      case TaskType.ASSIST_HARVESTER:
      case TaskType.ASSIST_UPGRADER:
        this.assistWorker(creep, task);
        break;
      case TaskType.SUPPLY_SPAWN:
      case TaskType.SUPPLY_EXTENSION:
        this.supplyStructure(creep, task);
        break;
      case TaskType.WITHDRAW_ENERGY:
        this.withdrawEnergy(creep, task);
        break;
      case TaskType.COLLECT_DROPPED:
        this.collectDropped(creep, task);
        break;
      default:
        console.log(`[搬运工] ${creep.name} 未知任务: ${task.type}`);
        TaskSystem.completeTask(creep);
        break;
    }
  }

  // 协助工人（矿工/升级者）- 兼容历史版本
  private static assistWorker(creep: Creep, task: any): void {
    let worker = null;
    let targetPos = null;
    
    // 兼容历史版本的任务结构
    if (task.type === 'assistStaticHarvester') {
      worker = Game.getObjectById(task.harvesterId);
      if (task.targetPosition) {
        targetPos = new RoomPosition(task.targetPosition.x, task.targetPosition.y, creep.room.name);
      }
    } else if (task.type === 'assistStaticUpgrader') {
      worker = Game.getObjectById(task.upgraderId);
      if (task.targetPosition) {
        targetPos = new RoomPosition(task.targetPosition.x, task.targetPosition.y, creep.room.name);
      }
    } else {
      // 新版本任务结构
      worker = Game.getObjectById(task.targetId);
      if (task.targetPos) {
        targetPos = task.targetPos;
      } else if (worker && (worker as any).memory.targetId) {
        const [x, y] = (worker as any).memory.targetId.split(',').map(Number);
        targetPos = new RoomPosition(x, y, creep.room.name);
      }
    }
    
    if (!worker) {
      TaskSystem.completeTask(creep);
      return;
    }

    const targetWorker = worker as Creep;
    
    // 如果工人已经在工作，任务完成
    if ((targetWorker.memory as any).working) {
      TaskSystem.completeTask(creep);
      return;
    }
    
    if (!targetPos) {
      console.log(`[搬运工] ${creep.name} 无法获取 ${targetWorker.name} 的目标位置`);
      TaskSystem.completeTask(creep);
      return;
    }

    // Pull协助逻辑：标准Screeps pull机制
    // 1. creep1.pull(creep2) - 搬运工请求拉拽
    // 2. creep2.move(creep1) - 被拉拽者配合移动 
    // 3. creep1.move(direction) - 搬运工实际移动
    
    // 如果工人已经在目标位置，任务完成
    if (targetWorker.pos.isEqualTo(targetPos)) {
      (targetWorker.memory as any).working = true;
      TaskSystem.completeTask(creep);
      console.log(`[搬运工] ${creep.name} 搬运 ${targetWorker.name} 完成`);
      return;
    }
    
    // 检查搬运工是否到达目标位置
    if (creep.pos.isEqualTo(targetPos)) {
      // 搬运工在目标位置，需要让位给工人
      this.handoverPosition(creep, targetWorker, targetPos);
      return;
    }
    
    // 移动到工人旁边
    if (!creep.pos.isNearTo(targetWorker)) {
      creep.moveTo(targetWorker);
      creep.say('🚶 接近');
      return;
    }
    
    // 标准pull序列：pull -> worker配合 -> carrier移动
    const pullResult = creep.pull(targetWorker);
    if (pullResult === OK) {
      // 通知工人配合（工人会在自己的逻辑中执行move(carrier)）
      // 这里搬运工直接朝目标移动
      const moveResult = creep.moveTo(targetPos);
      if (moveResult === OK || moveResult === ERR_TIRED) {
        creep.say('🚛 拖拽');
      } else {
        creep.say(`🚛 拖拽(${moveResult})`);
      }
    } else {
      creep.say(`❌ Pull失败(${pullResult})`);
    }
  }

  // 供应建筑
  private static supplyStructure(creep: Creep, task: any): void {
    const target = Game.getObjectById(task.targetId);
    if (!target) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 检查能量
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      console.log(`[搬运工] ${creep.name} 没有能量，任务失败`);
      TaskSystem.completeTask(creep);
      return;
    }

    // 检查目标是否还需要能量
    const structure = target as StructureSpawn | StructureExtension;
    if (structure.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 转移能量
    const result = creep.transfer(structure, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(structure);
      creep.say('🚚 供应');
    } else if (result === OK) {
      creep.say('⚡ 完成');
      TaskSystem.completeTask(creep);
    } else {
      TaskSystem.completeTask(creep);
    }
  }

  // 取能量
  private static withdrawEnergy(creep: Creep, task: any): void {
    const source = Game.getObjectById(task.targetId);
    if (!source) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 检查背包
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 取能量
    const container = source as StructureContainer | StructureStorage;
    const result = creep.withdraw(container, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(container);
      creep.say('📦 取能');
    } else if (result === OK) {
      creep.say('📦 完成');
      TaskSystem.completeTask(creep);
    } else {
      TaskSystem.completeTask(creep);
    }
  }

  // 收集掉落资源
  private static collectDropped(creep: Creep, task: any): void {
    const resource = Game.getObjectById(task.targetId);
    if (!resource) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 检查背包
    if (creep.store.getFreeCapacity() === 0) {
      TaskSystem.completeTask(creep);
      return;
    }

    // 收集资源
    const result = creep.pickup(resource as Resource);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(resource as Resource);
      creep.say('🧹 收集');
    } else if (result === OK) {
      creep.say('🧹 完成');
      TaskSystem.completeTask(creep);
    } else {
      TaskSystem.completeTask(creep);
    }
  }

  // 搬运工让位给静态工人（静态工人无MOVE部件）
  private static handoverPosition(carrier: Creep, worker: Creep, targetPos: RoomPosition): void {
    // 搬运工在目标位置，需要让位
    // 由于静态工人没有MOVE部件，只能通过pull把工人拉到目标位置
    
    // 如果工人已经相邻，最后一次pull
    if (worker.pos.isNearTo(targetPos)) {
      const pullResult = carrier.pull(worker);
      if (pullResult === OK) {
        // 搬运工移开，让工人占据目标位置
        const exitDirection = this.findSafeExitDirection(carrier.pos, targetPos);
        const moveResult = carrier.move(exitDirection);
        
        if (moveResult === OK) {
          carrier.say('🚚 让位');
          // 不立即完成任务，等工人检查自己是否能工作
          console.log(`[搬运工] ${carrier.name} 让位给 ${worker.name}`);
        } else {
          carrier.say(`🚚 让位失败:${moveResult}`);
        }
      } else {
        carrier.say(`❌ Pull失败:${pullResult}`);
      }
    } else {
      // 工人还没到相邻位置，继续pull
      const pullResult = carrier.pull(worker);
      if (pullResult === OK) {
        // 搬运工离开目标位置，继续拉拽工人
        const pullDirection = this.findSafeExitDirection(carrier.pos, targetPos);
        carrier.move(pullDirection);
        carrier.say('🚶 继续拉拽');
      }
    }
  }
  
  // 寻找安全的离开方向
  private static findSafeExitDirection(carrierPos: RoomPosition, targetPos: RoomPosition): DirectionConstant {
    // 尝试找一个不会阻挡其他creep的方向
    const directions: DirectionConstant[] = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
    
    for (const direction of directions) {
      try {
        const nextX = carrierPos.x + (direction === RIGHT || direction === TOP_RIGHT || direction === BOTTOM_RIGHT ? 1 : direction === LEFT || direction === TOP_LEFT || direction === BOTTOM_LEFT ? -1 : 0);
        const nextY = carrierPos.y + (direction === TOP || direction === TOP_RIGHT || direction === TOP_LEFT ? -1 : direction === BOTTOM || direction === BOTTOM_RIGHT || direction === BOTTOM_LEFT ? 1 : 0);
        
        if (nextX >= 0 && nextX <= 49 && nextY >= 0 && nextY <= 49) {
          const nextPos = new RoomPosition(nextX, nextY, carrierPos.roomName);
          if (!nextPos.isEqualTo(targetPos)) {
            // 检查地形
            const terrain = Game.map.getRoomTerrain(carrierPos.roomName);
            if (terrain.get(nextX, nextY) !== TERRAIN_MASK_WALL) {
              return direction;
            }
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    // 如果找不到好位置，就随便找一个
    return TOP;
  }
}