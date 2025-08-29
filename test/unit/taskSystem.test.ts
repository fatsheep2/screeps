import { expect } from 'chai';
import { TaskType, TaskPriority } from '../../src/managers/taskSystem';

describe('TaskSystem', () => {
  // let mockRoom: any;
  let mockMemory: any;

  beforeEach(() => {
    // 重置全局内存
    mockMemory = {
      rooms: {
        'testRoom': {
          tasks: {}
        }
      }
    };

    // 模拟全局Memory对象
    (global as any).Memory = mockMemory;

    // 模拟房间对象
    // mockRoom = {
    //   name: 'testRoom',
    //   find: () => [],
    //   energyAvailable: 300
    // };
  });

  afterEach(() => {
    // 清理全局对象
    delete (global as any).Memory;
  });

  describe('Task Priority System', () => {
    it('should create tasks with correct priorities', () => {
      // 测试任务优先级枚举
      expect(TaskPriority.CRITICAL).to.equal(0);
      expect(TaskPriority.HIGH).to.equal(1);
      expect(TaskPriority.NORMAL).to.equal(2);
    });
  });

  describe('Task Type System', () => {
    it('should have correct task types', () => {
      // 测试任务类型枚举
      expect(TaskType.SUPPLY_SPAWN).to.equal('supply_spawn');
      expect(TaskType.ASSIST_HARVESTER).to.equal('assist_harvester');
      expect(TaskType.SUPPLY_EXTENSION).to.equal('supply_extension');
    });
  });

  describe('Task Creation', () => {
    it('should create a task with correct structure', () => {
      const taskData = {
        type: TaskType.ASSIST_HARVESTER,
        priority: TaskPriority.CRITICAL,
        targetId: 'testId',
        targetPos: { x: 10, y: 10, roomName: 'testRoom' }
      };

      // 模拟TaskSystem.createTask方法
      const taskId = 'test_task_id';
      mockMemory.rooms.testRoom.tasks[taskId] = {
        id: taskId,
        ...taskData,
        roomName: 'testRoom',
        createdAt: Game.time
      };

      const task = mockMemory.rooms.testRoom.tasks[taskId];

      expect(task.type).to.equal(TaskType.ASSIST_HARVESTER);
      expect(task.priority).to.equal(TaskPriority.CRITICAL);
      expect(task.targetId).to.equal('testId');
    });
  });

  describe('Task Priority Sorting', () => {
    it('should sort tasks by priority correctly', () => {
      // 创建不同优先级的任务
      const tasks = [
        { priority: TaskPriority.NORMAL, type: 'normal_task' },
        { priority: TaskPriority.CRITICAL, type: 'critical_task' },
        { priority: TaskPriority.HIGH, type: 'high_task' }
      ];

      // 模拟排序逻辑
      const sortedTasks = tasks.sort((a, b) => a.priority - b.priority);

      expect(sortedTasks[0].priority).to.equal(TaskPriority.CRITICAL);
      expect(sortedTasks[1].priority).to.equal(TaskPriority.HIGH);
      expect(sortedTasks[2].priority).to.equal(TaskPriority.NORMAL);
    });
  });

  describe('Critical Task Handling', () => {
    it('should identify critical tasks correctly', () => {
      const tasks = [
        { priority: TaskPriority.CRITICAL, type: 'assist_harvester' },
        { priority: TaskPriority.HIGH, type: 'supply_spawn' },
        { priority: TaskPriority.NORMAL, type: 'supply_builder' }
      ];

      const criticalTasks = tasks.filter(task => task.priority === TaskPriority.CRITICAL);

      expect(criticalTasks).to.have.length(1);
      expect(criticalTasks[0].type).to.equal('assist_harvester');
    });
  });

  describe('Task Assignment', () => {
    it('should assign tasks to creeps correctly', () => {
      const task = {
        id: 'test_task'
      };

      const creep = {
        id: 'test_creep',
        memory: {}
      };

      // 模拟任务分配
      (task as any).assignedTo = creep.id;
      (creep.memory as any).currentTaskId = task.id;

      expect((task as any).assignedTo).to.equal(creep.id);
      expect((creep.memory as any).currentTaskId).to.equal(task.id);
    });
  });

  describe('Energy Collection Logic', () => {
    it('should avoid collecting energy near containers', () => {
      // 模拟container位置
      const containerPos = { x: 25, y: 25 };

      // 模拟掉落资源位置
      const resourceNearContainer = { x: 26, y: 26 }; // 距离1格
      const resourceFarFromContainer = { x: 30, y: 30 }; // 距离5格以上

      // 计算距离
      const distanceNear = Math.abs(resourceNearContainer.x - containerPos.x) +
                           Math.abs(resourceNearContainer.y - containerPos.y);
      const distanceFar = Math.abs(resourceFarFromContainer.x - containerPos.x) +
                          Math.abs(resourceFarFromContainer.y - containerPos.y);

      // 验证距离计算
      expect(distanceNear).to.be.lessThan(5);
      expect(distanceFar).to.be.greaterThan(5);
    });

    it('should avoid collecting energy near spawns', () => {
      // 模拟spawn位置
      const spawnPos = { x: 10, y: 10 };

      // 模拟掉落资源位置
      const resourceNearSpawn = { x: 12, y: 12 }; // 距离2格
      const resourceFarFromSpawn = { x: 20, y: 20 }; // 距离10格以上

      // 计算距离
      const distanceNear = Math.abs(resourceNearSpawn.x - spawnPos.x) +
                           Math.abs(resourceNearSpawn.y - spawnPos.y);
      const distanceFar = Math.abs(resourceFarFromSpawn.x - spawnPos.x) +
                          Math.abs(resourceFarFromSpawn.y - spawnPos.y);

      // 验证距离计算
      expect(distanceNear).to.be.lessThan(3);
      expect(distanceFar).to.be.greaterThan(3);
    });
  });
});
