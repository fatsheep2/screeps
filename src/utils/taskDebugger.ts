// 任务系统调试工具 - 蜂群思维监控
// 提供完整的任务系统状态监控和诊断功能

import { TaskSystem, Task, TaskType, TaskPriority } from '../managers/taskSystem';

export class TaskDebugger {

  // 显示房间任务系统完整状态
  public static debugRoomTaskSystem(room: Room): void {
    console.log(`\n=== 房间 ${room.name} 任务系统调试 ===`);

    // 1. 基础统计
    this.showBasicStats(room);

    // 2. 任务分配状态
    this.showTaskAssignmentStatus(room);

    // 3. 搬运工状态
    this.showCarrierStatus(room);

    // 4. 任务队列状态
    this.showTaskQueueStatus(room);

    // 5. 性能指标
    this.showPerformanceMetrics(room);

    console.log(`=== 调试完成 ===\n`);
  }

  // 显示基础统计信息
  private static showBasicStats(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = roomMemory.tasks || {};

    const totalTasks = Object.keys(tasks).length;
    const assignedTasks = Object.values(tasks).filter((t: any) => t.assignedTo).length;
    const pendingTasks = totalTasks - assignedTasks;

    console.log(`📊 基础统计:`);
    console.log(`  总任务数: ${totalTasks}`);
    console.log(`  已分配: ${assignedTasks}`);
    console.log(`  待分配: ${pendingTasks}`);
    console.log(`  分配率: ${totalTasks > 0 ? ((assignedTasks / totalTasks) * 100).toFixed(1) : 0}%`);
  }

  // 显示任务分配状态
  private static showTaskAssignmentStatus(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = roomMemory.tasks || {};

    console.log(`\n🎯 任务分配状态:`);

    // 按类型统计
    const typeStats: { [type: string]: { total: number; assigned: number; pending: number } } = {};

    for (const task of Object.values(tasks) as Task[]) {
      if (!typeStats[task.type]) {
        typeStats[task.type] = { total: 0, assigned: 0, pending: 0 };
      }

      typeStats[task.type].total++;
      if (task.assignedTo) {
        typeStats[task.type].assigned++;
      } else {
        typeStats[task.type].pending++;
      }
    }

    for (const [type, stats] of Object.entries(typeStats)) {
      const assignmentRate = ((stats.assigned / stats.total) * 100).toFixed(1);
      console.log(`  ${type}: ${stats.assigned}/${stats.total} (${assignmentRate}%)`);
    }
  }

  // 显示搬运工状态
  private static showCarrierStatus(room: Room): void {
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === 'carrier'
    });

    console.log(`\n🚛 搬运工状态:`);
    console.log(`  总数量: ${carriers.length}`);

    if (carriers.length === 0) {
      console.log(`  ⚠️  警告: 没有搬运工!`);
      return;
    }

    const busyCarriers = carriers.filter(c => c.memory.currentTaskId);
    const idleCarriers = carriers.filter(c => !c.memory.currentTaskId);

    console.log(`  忙碌: ${busyCarriers.length}`);
    console.log(`  空闲: ${idleCarriers.length}`);
    console.log(`  利用率: ${((busyCarriers.length / carriers.length) * 100).toFixed(1)}%`);

    // 显示忙碌搬运工的详细信息
    if (busyCarriers.length > 0) {
      console.log(`\n  忙碌搬运工详情:`);
      for (const carrier of busyCarriers) {
        const task = TaskSystem.getCreepTask(carrier);
        if (task) {
          console.log(`    ${carrier.name}: ${task.type} (优先级:${task.priority})`);
        }
      }
    }

    // 显示空闲搬运工
    if (idleCarriers.length > 0) {
      console.log(`\n  空闲搬运工: ${idleCarriers.map(c => c.name).join(', ')}`);
    }
  }

  // 显示任务队列状态
  private static showTaskQueueStatus(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = roomMemory.tasks || {};

    console.log(`\n📋 任务队列状态:`);

    // 按优先级分组
    const priorityGroups: { [priority: number]: Task[] } = {
      [TaskPriority.CRITICAL]: [],
      [TaskPriority.HIGH]: [],
      [TaskPriority.NORMAL]: []
    };

    for (const task of Object.values(tasks) as Task[]) {
      if (!task.assignedTo) {
        priorityGroups[task.priority].push(task);
      }
    }

    for (const [priority, taskList] of Object.entries(priorityGroups)) {
      const priorityName = this.getPriorityName(parseInt(priority));
      console.log(`  ${priorityName}: ${taskList.length} 个待分配`);

      if (taskList.length > 0) {
        for (const task of taskList.slice(0, 3)) { // 只显示前3个
          console.log(`    - ${task.type} (${task.id})`);
        }
        if (taskList.length > 3) {
          console.log(`    ... 还有 ${taskList.length - 3} 个`);
        }
      }
    }
  }

  // 显示性能指标
  private static showPerformanceMetrics(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = roomMemory.tasks || {};

    console.log(`\n⚡ 性能指标:`);

    // 计算任务平均等待时间
    const now = Game.time;
    const pendingTasks = Object.values(tasks).filter((t: any) => !t.assignedTo) as Task[];

    if (pendingTasks.length > 0) {
      const totalWaitTime = pendingTasks.reduce((sum, task) => sum + (now - task.createdAt), 0);
      const avgWaitTime = totalWaitTime / pendingTasks.length;

      console.log(`  平均等待时间: ${avgWaitTime.toFixed(1)} ticks`);

      // 找出等待最久的任务
      const oldestTask = pendingTasks.reduce((oldest, current) =>
        current.createdAt < oldest.createdAt ? current : oldest
      );
      const oldestWaitTime = now - oldestTask.createdAt;
      console.log(`  最长等待时间: ${oldestWaitTime} ticks (${oldestTask.type})`);

      if (oldestWaitTime > 100) {
        console.log(`  ⚠️  警告: 有任务等待过久!`);
      }
    }

    // 计算任务完成率（基于已分配任务）
    const assignedTasks = Object.values(tasks).filter((t: any) => t.assignedTo) as Task[];
    if (assignedTasks.length > 0) {
      console.log(`  当前执行任务数: ${assignedTasks.length}`);
    }
  }

  // 显示特定任务的详细信息
  public static debugSpecificTask(room: Room, taskId: string): void {
    const roomMemory = this.getRoomMemory(room);
    const task = roomMemory.tasks?.[taskId] as Task;

    if (!task) {
      console.log(`❌ 任务 ${taskId} 不存在`);
      return;
    }

    console.log(`\n=== 任务 ${taskId} 详细信息 ===`);
    console.log(`类型: ${task.type}`);
    console.log(`优先级: ${this.getPriorityName(task.priority)}`);
    console.log(`房间: ${task.roomName}`);
    console.log(`创建时间: ${task.createdAt} (${Game.time - task.createdAt} ticks前)`);
    console.log(`分配状态: ${task.assignedTo ? '已分配' : '待分配'}`);

    if (task.assignedTo) {
      const carrier = Game.creeps[task.assignedTo];
      if (carrier) {
        console.log(`分配给: ${carrier.name} (${carrier.pos.x}, ${carrier.pos.y})`);
        console.log(`搬运工状态: ${carrier.memory.currentTaskId === taskId ? '正常' : '⚠️ 内存不一致'}`);
      } else {
        console.log(`分配给: ${task.assignedTo} (⚠️ creep已死亡)`);
      }
    }

    if (task.targetId) {
      console.log(`目标ID: ${task.targetId}`);
    }

    if (task.targetPos) {
      console.log(`目标位置: (${task.targetPos.x}, ${task.targetPos.y})`);
    }

    if (task.amount) {
      console.log(`数量: ${task.amount}`);
    }

    if (task.resourceType) {
      console.log(`资源类型: ${task.resourceType}`);
    }

    console.log(`=== 任务详情结束 ===\n`);
  }

  // 显示所有相关任务的关联关系
  public static debugTaskRelationships(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = roomMemory.tasks || {};

    console.log(`\n=== 房间 ${room.name} 任务关联关系 ===`);

    // 按目标ID分组
    const targetGroups: { [targetId: string]: Task[] } = {};

    for (const task of Object.values(tasks) as Task[]) {
      if (task.targetId) {
        if (!targetGroups[task.targetId]) {
          targetGroups[task.targetId] = [];
        }
        targetGroups[task.targetId].push(task);
      }
    }

    for (const [targetId, taskList] of Object.entries(targetGroups)) {
      if (taskList.length > 1) {
        console.log(`\n目标 ${targetId} 有 ${taskList.length} 个相关任务:`);
        for (const task of taskList) {
          const status = task.assignedTo ? '已分配' : '待分配';
          const carrier = task.assignedTo ? Game.creeps[task.assignedTo]?.name : '无';
          console.log(`  - ${task.type} (${status}, 分配给: ${carrier})`);
        }
      }
    }

    console.log(`=== 任务关联关系结束 ===\n`);
  }

  // 强制清理无效任务
  public static forceCleanupInvalidTasks(room: Room): void {
    const roomMemory = this.getRoomMemory(room);
    const tasks = roomMemory.tasks || {};
    const tasksToDelete: string[] = [];

    console.log(`\n🧹 开始强制清理无效任务...`);

    for (const [taskId, task] of Object.entries(tasks)) {
      const typedTask = task as Task;

      // 检查分配的creep是否还存在
      if (typedTask.assignedTo && !Game.creeps[typedTask.assignedTo]) {
        console.log(`  清理任务 ${typedTask.type} (creep已死亡)`);
        tasksToDelete.push(taskId);
      }

      // 检查任务是否过期（超过300ticks）
      if (Game.time - typedTask.createdAt > 300) {
        console.log(`  清理任务 ${typedTask.type} (已过期)`);
        tasksToDelete.push(taskId);
      }
    }

    // 执行清理
    for (const taskId of tasksToDelete) {
      delete roomMemory.tasks![taskId];
    }

    console.log(`  清理完成，删除了 ${tasksToDelete.length} 个无效任务`);
  }

  // 重置所有任务状态
  public static resetAllTasks(room: Room): void {
    const roomMemory = this.getRoomMemory(room);

    console.log(`\n🔄 重置房间 ${room.name} 的所有任务...`);

    // 清理所有任务
    roomMemory.tasks = {};

    // 清理所有搬运工的任务ID
    const carriers = room.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === 'carrier'
    });

    for (const carrier of carriers) {
      delete carrier.memory.currentTaskId;
    }

    console.log(`  重置完成，清理了 ${carriers.length} 个搬运工的任务状态`);
  }

  // 获取优先级名称
  private static getPriorityName(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.CRITICAL: return 'CRITICAL';
      case TaskPriority.HIGH: return 'HIGH';
      case TaskPriority.NORMAL: return 'NORMAL';
      default: return 'UNKNOWN';
    }
  }

  // 获取房间内存
  private static getRoomMemory(room: Room): any {
    if (!Memory.rooms[room.name]) {
      Memory.rooms[room.name] = {
        staticHarvesters: 0,
        upgraders: 0,
        builders: 0,
        carriers: 0,
        miningSpots: [],
        totalAvailableSpots: 0,
        tasks: {}
      };
    }

    if (!Memory.rooms[room.name].tasks) {
      Memory.rooms[room.name].tasks = {};
    }

    return Memory.rooms[room.name];
  }
}
