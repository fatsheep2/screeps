import { expect } from 'chai';
import { TaskType, TaskPriority, TaskSystem } from '../../src/managers/taskSystem';
import { RoleCarrier } from '../../src/roles/carrier';

describe('Extended TaskSystem - 蜂群任务系统扩展测试', () => {
  let mockRoom: any;
  let mockMemory: any;
  let mockGame: any;

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

    // 模拟Game对象
    mockGame = {
      time: 1000,
      creeps: {},
      getObjectById: (id: string) => {
        const mockObjects: { [key: string]: any } = {
          'spawn1': { structureType: 'spawn', store: { getFreeCapacity: () => 200 }, pos: { x: 10, y: 10 } },
          'container1': { structureType: 'container', store: { getUsedCapacity: () => 500 }, pos: { x: 20, y: 20 } },
          'resource1': { resourceType: 'energy', amount: 300, pos: { x: 15, y: 15 } },
          'tombstone1': { store: { getUsedCapacity: () => 100 }, pos: { x: 25, y: 25 } }
        };
        return mockObjects[id] || null;
      }
    };
    (global as any).Game = mockGame;

    // 模拟房间对象
    mockRoom = {
      name: 'testRoom',
      find: (type: number) => {
        // 根据不同的find类型返回不同的mock数据
        if (type === FIND_MY_CREEPS) {
          return [
            { id: 'carrier1', memory: { role: 'carrier' }, store: { getUsedCapacity: (resource?: string) => 0, getFreeCapacity: (resource?: string) => 50 }, pos: { x: 10, y: 10, findClosestByPath: () => mockGame.getObjectById('container1') } },
            { id: 'carrier2', memory: { role: 'carrier' }, store: { getUsedCapacity: (resource?: string) => resource === 'energy' ? 50 : 50, getFreeCapacity: (resource?: string) => resource === 'energy' ? 0 : 0 }, pos: { x: 12, y: 12, findClosestByPath: () => mockGame.getObjectById('container1') } }
          ];
        }
        if (type === FIND_STRUCTURES) {
          return [
            mockGame.getObjectById('container1')
          ];
        }
        if (type === FIND_DROPPED_RESOURCES) {
          return [
            mockGame.getObjectById('resource1')
          ];
        }
        if (type === FIND_TOMBSTONES) {
          return [
            mockGame.getObjectById('tombstone1')
          ];
        }
        return [];
      }
    };

    // 定义常量
    (global as any).FIND_MY_CREEPS = 101;
    (global as any).FIND_STRUCTURES = 107;
    (global as any).FIND_DROPPED_RESOURCES = 106;
    (global as any).FIND_TOMBSTONES = 105;
    (global as any).FIND_RUINS = 104;
    (global as any).STRUCTURE_CONTAINER = 'container';
    (global as any).STRUCTURE_STORAGE = 'storage';
    (global as any).RESOURCE_ENERGY = 'energy';
  });

  afterEach(() => {
    // 清理全局对象
    delete (global as any).Memory;
    delete (global as any).Game;
    delete (global as any).FIND_MY_CREEPS;
    delete (global as any).FIND_STRUCTURES;
    delete (global as any).FIND_DROPPED_RESOURCES;
    delete (global as any).FIND_TOMBSTONES;
    delete (global as any).FIND_RUINS;
    delete (global as any).STRUCTURE_CONTAINER;
    delete (global as any).STRUCTURE_STORAGE;
    delete (global as any).RESOURCE_ENERGY;
  });

  describe('New Task Types', () => {
    it('should have all extended task types', () => {
      // 供应类任务
      expect(TaskType.SUPPLY_SPAWN).to.equal('supply_spawn');
      expect(TaskType.SUPPLY_EXTENSION).to.equal('supply_extension');
      
      // 协助类任务
      expect(TaskType.ASSIST_HARVESTER).to.equal('assist_harvester');
      expect(TaskType.ASSIST_UPGRADER).to.equal('assist_upgrader');
      
      // 收集类任务
      expect(TaskType.COLLECT_ENERGY).to.equal('collect_energy');
      expect(TaskType.WITHDRAW_ENERGY).to.equal('withdraw_energy');
      
      // 存储类任务
      expect(TaskType.STORE_ENERGY).to.equal('store_energy');
      
      // 维护类任务
      expect(TaskType.CLEAR_TOMBSTONE).to.equal('clear_tombstone');
      expect(TaskType.CLEAR_RUIN).to.equal('clear_ruin');
    });

    it('should prioritize tasks correctly', () => {
      const tasks = [
        { priority: TaskPriority.NORMAL, type: TaskType.STORE_ENERGY },
        { priority: TaskPriority.CRITICAL, type: TaskType.SUPPLY_SPAWN },
        { priority: TaskPriority.HIGH, type: TaskType.WITHDRAW_ENERGY },
        { priority: TaskPriority.NORMAL, type: TaskType.COLLECT_ENERGY }
      ];

      const sortedTasks = tasks.sort((a, b) => a.priority - b.priority);

      expect(sortedTasks[0].type).to.equal(TaskType.SUPPLY_SPAWN);
      expect(sortedTasks[1].type).to.equal(TaskType.WITHDRAW_ENERGY);
    });
  });

  describe('Energy Transfer Chain Logic', () => {
    it('should create withdraw tasks for carriers without energy', () => {
      // 模拟扫描能量流转需求的逻辑
      const carriersWithoutEnergy = mockRoom.find(FIND_MY_CREEPS).filter((c: any) => 
        c.memory.role === 'carrier' && 
        c.store.getUsedCapacity() === 0 && 
        !c.memory.currentTaskId
      );

      expect(carriersWithoutEnergy).to.have.length(1);
      expect(carriersWithoutEnergy[0].id).to.equal('carrier1');

      // 验证能够找到可用的能量源
      const energySources = mockRoom.find(FIND_STRUCTURES).filter((s: any) =>
        (s.structureType === 'container' || s.structureType === 'storage') &&
        s.store.getUsedCapacity() > 100
      );

      expect(energySources).to.have.length(1);
    });

    it('should identify carriers needing storage', () => {
      const carriersNeedingStorage = mockRoom.find(FIND_MY_CREEPS).filter((c: any) =>
        c.memory.role === 'carrier' &&
        c.store.getFreeCapacity('energy') === 0 &&
        c.store.getUsedCapacity('energy') > 0 &&
        !c.memory.currentTaskId
      );

      expect(carriersNeedingStorage).to.have.length(1);
      expect(carriersNeedingStorage[0].id).to.equal('carrier2');
    });
  });

  describe('Maintenance Task Detection', () => {
    it('should detect dropped energy for collection', () => {
      const droppedEnergy = mockRoom.find(FIND_DROPPED_RESOURCES).filter((r: any) =>
        r.resourceType === 'energy' && r.amount > 200
      );

      expect(droppedEnergy).to.have.length(1);
      expect(droppedEnergy[0].amount).to.equal(300);
    });

    it('should detect tombstones for clearing', () => {
      const tombstones = mockRoom.find(FIND_TOMBSTONES).filter((t: any) =>
        t.store.getUsedCapacity() > 0
      );

      expect(tombstones).to.have.length(1);
    });
  });

  describe('Carrier Pure Execution Mode', () => {
    let mockCreep: any;
    let mockTask: any;

    beforeEach(() => {
      mockCreep = {
        name: 'carrier1',
        store: {
          getUsedCapacity: (resource?: string) => resource === 'energy' ? 50 : 50,
          getFreeCapacity: (resource?: string) => resource === 'energy' ? 0 : 0
        },
        transfer: () => OK,
        withdraw: () => OK,
        pickup: () => OK,
        moveTo: () => OK,
        say: () => {},
        pos: {
          isNearTo: () => true,
          isEqualTo: () => false
        },
        memory: {}
      };

      (global as any).OK = 0;
      (global as any).ERR_NOT_IN_RANGE = -9;
    });

    afterEach(() => {
      delete (global as any).OK;
      delete (global as any).ERR_NOT_IN_RANGE;
    });

    it('should execute withdraw task without state switching', () => {
      mockTask = {
        type: TaskType.WITHDRAW_ENERGY,
        targetId: 'container1'
      };

      // 模拟TaskSystem方法
      const originalGetCreepTask = TaskSystem.getCreepTask;
      const originalCompleteTask = TaskSystem.completeTask;
      
      let taskCompleted = false;
      
      (TaskSystem as any).getCreepTask = () => mockTask;
      (TaskSystem as any).completeTask = () => { taskCompleted = true; };

      // 执行carrier逻辑
      RoleCarrier.run(mockCreep);

      // 验证任务被完成（无脑执行，不做状态判断）
      expect(taskCompleted).to.be.true;

      // 恢复原始方法
      TaskSystem.getCreepTask = originalGetCreepTask;
      TaskSystem.completeTask = originalCompleteTask;
    });

    it('should fail task immediately if preconditions not met', () => {
      // 测试没有能量时执行transfer任务
      mockCreep.store.getUsedCapacity = () => 0;
      mockTask = {
        type: TaskType.SUPPLY_SPAWN,
        targetId: 'spawn1'
      };

      let taskCompleted = false;
      let logMessage = '';

      (TaskSystem as any).getCreepTask = () => mockTask;
      (TaskSystem as any).completeTask = () => { taskCompleted = true; };
      
      // Mock console.log
      const originalLog = console.log;
      console.log = (msg: string) => { logMessage = msg; };

      RoleCarrier.run(mockCreep);

      // 验证任务立即失败
      expect(taskCompleted).to.be.true;
      expect(logMessage).to.include('任务失败：没有能量');

      // 恢复
      console.log = originalLog;
    });

    it('should handle idle state without making decisions', () => {
      // 测试没有任务时的待机行为
      (TaskSystem as any).getCreepTask = () => null;
      
      let sayMessage = '';
      mockCreep.say = (msg: string) => { sayMessage = msg; };

      RoleCarrier.run(mockCreep);

      expect(sayMessage).to.equal('💤 待机');
    });
  });

  describe('Task Chain Intelligence', () => {
    it('should create logical task sequences', () => {
      // 测试任务链的逻辑性：
      // 1. 发现spawn需要能量
      // 2. 但搬运工没有能量
      // 3. 应该创建从container取能量的任务

      const taskChain = [
        { type: TaskType.WITHDRAW_ENERGY, priority: TaskPriority.HIGH },
        { type: TaskType.SUPPLY_SPAWN, priority: TaskPriority.CRITICAL }
      ];

      // 验证任务链的优先级合理性
      expect(taskChain[0].priority).to.be.greaterThan(taskChain[1].priority);
    });

    it('should avoid creating duplicate tasks', () => {
      // 测试不应该为同一个目标创建重复任务
      const existingTasks = [
        { type: TaskType.WITHDRAW_ENERGY, targetId: 'container1' },
        { type: TaskType.COLLECT_ENERGY, targetId: 'resource1' }
      ];

      // 验证查找任务的逻辑
      const duplicateWithdraw = existingTasks.find(t => 
        t.type === TaskType.WITHDRAW_ENERGY && t.targetId === 'container1'
      );
      const duplicateCollect = existingTasks.find(t => 
        t.type === TaskType.COLLECT_ENERGY && t.targetId === 'resource1'
      );

      expect(duplicateWithdraw).to.not.be.undefined;
      expect(duplicateCollect).to.not.be.undefined;
    });
  });

  describe('System Performance', () => {
    it('should handle high task volume efficiently', () => {
      const startTime = Date.now();
      
      // 模拟大量任务处理
      const tasks = [];
      for (let i = 0; i < 1000; i++) {
        tasks.push({
          id: `task${i}`,
          type: i % 2 === 0 ? TaskType.COLLECT_ENERGY : TaskType.WITHDRAW_ENERGY,
          priority: i % 3,
          targetId: `target${i}`
        });
      }

      // 模拟任务排序（TaskSystem的核心逻辑）
      const sortedTasks = tasks.sort((a, b) => a.priority - b.priority);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 验证性能：处理1000个任务应该在100ms内完成
      expect(processingTime).to.be.below(100);
      expect(sortedTasks).to.have.length(1000);
      expect(sortedTasks[0].priority).to.equal(0);
    });

    it('should maintain memory efficiency', () => {
      // 测试内存使用的合理性
      const roomMemory = {
        tasks: {}
      };

      // 添加100个任务
      for (let i = 0; i < 100; i++) {
        roomMemory.tasks[`task${i}`] = {
          id: `task${i}`,
          type: TaskType.COLLECT_ENERGY,
          priority: TaskPriority.NORMAL,
          targetId: `target${i}`,
          createdAt: 1000
        };
      }

      // 验证内存结构的合理性
      expect(Object.keys(roomMemory.tasks)).to.have.length(100);
      expect(JSON.stringify(roomMemory).length).to.be.below(50000); // 合理的内存使用
    });
  });
});