import {
  Task,
  TaskStatus,
  TaskStatistics,
  TaskFilter,
  TaskPriority
} from '../types/tasks';

// 任务管理器：负责房间内所有任务的验证、状态监控和清理
export class RoomTaskManager {
  private tasks: Map<string, Task> = new Map();
  private roomName: string;

  constructor(roomName: string) {
    this.roomName = roomName;
    this.loadTasks();
  }

  // 从内存加载任务
  private loadTasks(): void {
    if (!Memory.rooms[this.roomName]) {
      Memory.rooms[this.roomName] = {
        staticHarvesters: 0,
        upgraders: 0,
        builders: 0,
        carriers: 0,
        miningSpots: [],
        totalAvailableSpots: 0
      };
    }
    if (!Memory.rooms[this.roomName].tasks) {
      Memory.rooms[this.roomName].tasks = {};
    }

    const memoryTasks = Memory.rooms[this.roomName].tasks!;
    for (const taskId in memoryTasks) {
      const task = memoryTasks[taskId] as Task;
      if (task && this.isTaskValid(task)) {
        this.tasks.set(taskId, task);
      }
    }
  }

  // 保存任务到内存
  private saveTasks(): void {
    if (!Memory.rooms[this.roomName]) {
      Memory.rooms[this.roomName] = {
        staticHarvesters: 0,
        upgraders: 0,
        builders: 0,
        carriers: 0,
        miningSpots: [],
        totalAvailableSpots: 0
      };
    }
    Memory.rooms[this.roomName].tasks = {};

    for (const [taskId, task] of this.tasks) {
      Memory.rooms[this.roomName].tasks![taskId] = task;
    }
  }

  // 检查任务是否有效
  private isTaskValid(task: Task): boolean {
    if (Game.time > task.expiresAt) return false;

    switch (task.type) {
      case 'assistStaticHarvester':
        const harvester = Game.getObjectById(task.harvesterId) as Creep;
        if (!harvester || harvester.memory.role !== 'staticHarvester') {
          console.log(`[任务管理器] 静态矿工任务无效，矿工不存在或角色错误: ${task.harvesterId}`);
          return false;
        }
        return true;
      case 'collectEnergy':
        const energy = Game.getObjectById(task.targetId);
        if (!energy) {
          console.log(`[任务管理器] 收集能量任务无效，目标不存在: ${task.targetId}`);
          return false;
        }
        return true;
      case 'transferEnergy':
        const structure = Game.getObjectById(task.targetId);
        if (!structure) {
          console.log(`[任务管理器] 转移能量任务无效，目标不存在: ${task.targetId}`);
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  // 验证任务有效性（供外部调用）
  public validateTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const isValid = this.isTaskValid(task);
    if (!isValid) {
      console.log(`[任务管理器] 任务 ${taskId} 验证失败，标记为无效`);
      this.markTaskAsInvalid(taskId);
    }

    return isValid;
  }

  // 标记任务为无效
  private markTaskAsInvalid(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.errorMessage = '任务验证失败';
      this.tasks.set(taskId, task);
      this.saveTasks();
    }
  }

  // 检查任务是否超时
  public checkTaskTimeout(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const isTimeout = Game.time > task.expiresAt;
    if (isTimeout) {
      console.log(`[任务管理器] 任务 ${taskId} 已超时，标记为失败`);
      this.markTaskAsTimeout(taskId);
    }

    return isTimeout;
  }

  // 标记任务为超时
  private markTaskAsTimeout(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.errorMessage = '任务执行超时';
      this.tasks.set(taskId, task);
      this.saveTasks();
    }
  }

  // 监控任务执行状态
  public monitorTaskExecution(): void {
    for (const [taskId, _task] of this.tasks) {
      // 检查任务是否超时
      this.checkTaskTimeout(taskId);

      // 检查任务是否仍然有效
      this.validateTask(taskId);
    }
  }

  // 根据过滤器查找任务
  public findTaskByFilter(filter: TaskFilter): Task[] {
    const result: Task[] = [];

    for (const task of this.tasks.values()) {
      if (this.matchesFilter(task, filter)) {
        result.push(task);
      }
    }

    return result.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));
  }

  // 检查任务是否匹配过滤器
  private matchesFilter(task: Task, filter: TaskFilter): boolean {
    if (filter.type && task.type !== filter.type) return false;
    if (filter.status && task.status !== filter.status) return false;
    if (filter.priority && task.priority !== filter.priority) return false;
    if (filter.roomName && task.roomName !== filter.roomName) return false;
    if (filter.assignedTo && task.assignedTo !== filter.assignedTo) return false;
    return true;
  }

  // 获取优先级数值
  private getPriorityValue(priority: TaskPriority): number {
    switch (priority) {
      case 'urgent': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  // 获取爬爬的当前任务
  public getCreepTask(creepId: string): Task | null {
    // 先通过creepId查找
    for (const task of this.tasks.values()) {
      if (task.assignedTo === creepId && (task.status === 'assigned' || task.status === 'in_progress')) {
        return task;
      }
    }

    // 如果没找到，尝试通过creep名称查找（因为assignedTo存储的是名称）
    const creep = Game.creeps[creepId];
    if (creep) {
      for (const task of this.tasks.values()) {
        if (task.assignedTo === creep.name && (task.status === 'assigned' || task.status === 'in_progress')) {
          return task;
        }
      }
    }

    return null;
  }

  // 更新任务状态
  public updateTaskStatus(taskId: string, status: TaskStatus, message?: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = status;
    if (status === 'completed') {
      task.completedAt = Game.time;
    } else if (status === 'failed') {
      task.errorMessage = message || '任务执行失败';
    }

    this.tasks.set(taskId, task);
    this.saveTasks();
    console.log(`[任务管理器] 任务 ${taskId} 状态更新为: ${status}`);
    return true;
  }

  // 更新任务分配信息
  public updateTaskAssignment(taskId: string, assignedTo: string, status: TaskStatus = 'assigned'): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.assignedTo = assignedTo;
    task.assignedAt = Game.time;
    task.status = status;

    this.tasks.set(taskId, task);
    this.saveTasks();
    console.log(`[任务管理器] 任务 ${taskId} 分配给: ${assignedTo}, 状态: ${status}`);
    return true;
  }

  // 添加新任务到管理器（供外部调用）
  public addTask(task: Task): boolean {
    if (this.tasks.has(task.id)) {
      console.log(`[任务管理器] 任务 ${task.id} 已存在，更新任务`);
      this.tasks.set(task.id, task);
    } else {
      console.log(`[任务管理器] 添加新任务: ${task.id} (${task.type})`);
      this.tasks.set(task.id, task);
    }

    // 同步到内存
    this.saveTasks();
    return true;
  }

  // 从内存重新加载所有任务（用于修复状态不一致）
  public reloadTasks(): void {
    console.log(`[任务管理器] 重新加载房间 ${this.roomName} 的所有任务`);
    this.tasks.clear();
    this.loadTasks();
    console.log(`[任务管理器] 重新加载完成，当前有 ${this.tasks.size} 个任务`);
  }

  // 完成任务
  public completeTask(taskId: string): boolean {
    return this.updateTaskStatus(taskId, 'completed');
  }

  // 清理过期和无效任务
  public cleanupTasks(): void {
    const toDelete: string[] = [];

    for (const [taskId, task] of this.tasks) {
      if (!this.isTaskValid(task) || task.status === 'failed' || task.status === 'completed') {
        toDelete.push(taskId);
      }
    }

    for (const taskId of toDelete) {
      this.tasks.delete(taskId);
    }

    if (toDelete.length > 0) {
      this.saveTasks();
      console.log(`[任务管理器] 清理了 ${toDelete.length} 个过期/无效/已完成任务`);
    }
  }

  // 获取任务统计
  public getStatistics(): TaskStatistics {
    const stats: TaskStatistics = {
      total: this.tasks.size,
      pending: 0,
      assigned: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      expired: 0
    };

    for (const task of this.tasks.values()) {
      if (task.status === 'in_progress') {
        stats.inProgress++;
      } else {
        stats[task.status]++;
      }
    }

    return stats;
  }

  // 定期监控任务状态
  public monitorTasks(): void {
    this.cleanupTasks();
    this.monitorTaskExecution();
  }
}

// 全局任务管理器实例缓存
const taskManagers = new Map<string, RoomTaskManager>();

// 获取房间任务管理器
export function getRoomTaskManager(roomName: string): RoomTaskManager {
  if (!taskManagers.has(roomName)) {
    taskManagers.set(roomName, new RoomTaskManager(roomName));
  }
  return taskManagers.get(roomName)!;
}
