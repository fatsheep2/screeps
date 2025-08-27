import { Task, TaskExecutionResult, AssistStaticHarvesterTask } from '../types/tasks';

// 任务执行器：负责执行各种类型的任务
export class TaskExecutor {
  
  // 执行协助静态矿工任务
  public static executeAssistStaticHarvesterTask(creep: Creep, task: AssistStaticHarvesterTask): TaskExecutionResult {
    const harvester = Game.creeps[task.harvesterId];
    
    if (!harvester || harvester.memory.role !== 'staticHarvester') {
      return { success: false, shouldContinue: false, message: '目标矿工不存在' };
    }

    // 检查矿工是否已经到达目标位置
    const targetPos = new RoomPosition(task.targetPosition.x, task.targetPosition.y, creep.room.name);
    if (harvester.pos.isEqualTo(targetPos)) {
      return { success: true, shouldContinue: false, message: '矿工已到达目标位置' };
    }

    // 检查是否已经完成交换
    if (harvester.pos.isEqualTo(targetPos) && !creep.pos.isEqualTo(targetPos)) {
      creep.say('✅ 交换完成');
      return { success: true, shouldContinue: false, message: '交换完成' };
    }

    // 检查运输兵是否已经到达目标位置
    if (creep.pos.isEqualTo(targetPos)) {
      creep.say('📍 等待矿工');
      
      // 直接和矿工交换位置
      const pullResult = creep.pull(harvester);
      if (pullResult == OK) {
        const moveResult = harvester.move(creep);
        if (moveResult == OK) {
          const harvesterOriginalPos = harvester.pos;
          creep.moveTo(harvesterOriginalPos, {
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 3
          });
          creep.say('🔄 交换中');
        }
      } else {
        creep.say('❌ Pull失败');
        creep.moveTo(harvester, {
          visualizePathStyle: { stroke: '#ffaa00' },
          reusePath: 3
        });
      }
      return { success: true, shouldContinue: true, message: '正在交换位置' };
    }

    // 还没到达目标位置，需要同时考虑与矿工的距离
    const distanceToHarvester = creep.pos.getRangeTo(harvester);

    // 如果矿工距离太远，先回到矿工身边
    if (distanceToHarvester > 1) {
      creep.say(`📢 回到矿工身边`);
      creep.moveTo(harvester, {
        visualizePathStyle: { stroke: '#00ff00' },
        reusePath: 3
      });
      return { success: true, shouldContinue: true, message: '正在回到矿工身边' };
    }

    // 矿工在附近，可以一起移动
    creep.say(`🚶 前往目标`);

    // 一直 pull 矿工，直到到达目标位置
    const pullResult = creep.pull(harvester);
    if (pullResult == OK) {
      harvester.move(creep);
      creep.moveTo(targetPos, {
        visualizePathStyle: { stroke: '#00ff00' },
        reusePath: 5
      });
      creep.say('🔄 前进');
    } else {
      creep.moveTo(harvester, {
        visualizePathStyle: { stroke: '#00ff00' },
        reusePath: 3
      });
    }

    return { success: true, shouldContinue: true, message: '正在协助移动' };
  }

  // 通用任务执行方法
  public static executeTask(creep: Creep, task: Task): TaskExecutionResult {
    switch (task.type) {
      case 'assistStaticHarvester':
        return this.executeAssistStaticHarvesterTask(creep, task as AssistStaticHarvesterTask);
      default:
        return { success: false, shouldContinue: false, message: '不支持的任务类型' };
    }
  }
}
