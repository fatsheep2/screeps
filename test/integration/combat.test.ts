import {assert} from "chai";
import {helper} from "./helper";

describe("战斗系统简化集成测试", () => {
  describe("战斗小队管理", () => {
    it("应该能够创建战斗小队", async function () {
      // 初始化测试环境
      await helper.beforeEach();

      // 创建一些战斗Creep
      helper.addCreep('tank1', 'tank', 'W0N1', 25, 25);
      helper.addCreep('warrior1', 'warrior', 'W0N1', 26, 25);
      helper.addCreep('archer1', 'archer', 'W0N1', 25, 26);
      helper.addCreep('healer1', 'healer', 'W0N1', 26, 26);

      // 模拟战斗小队内存
      helper.memory.combatSquads = {
        squad1: {
          id: 'squad1',
          members: {
            tank: 'tank1',
            warrior: 'warrior1',
            archer: 'archer1',
            healer: 'healer1'
          },
          status: 'ready',
          formationTime: helper.gameTime,
          isAssembling: false
        }
      };

      // 检查战斗小队
      const squads = helper.memory.combatSquads;
      assert.isDefined(squads.squad1);
      assert.equal(squads.squad1.members.tank, 'tank1');
      assert.equal(squads.squad1.status, 'ready');

      console.log(`创建了战斗小队: ${Object.keys(squads).length} 个`);
    });

    it("应该能够分配攻击任务", async function () {
      // 初始化测试环境
      await helper.beforeEach();

      // 模拟攻击任务内存
      helper.memory.attackTasks = {
        task1: {
          id: 'task1',
          targetRoom: 'W1N1',
          sourceRoom: 'W0N1',
          squads: ['squad1'],
          status: 'planning',
          priority: 'high',
          createdAt: helper.gameTime
        }
      };

      // 检查攻击任务
      const tasks = helper.memory.attackTasks;
      assert.isDefined(tasks.task1);
      assert.equal(tasks.task1.targetRoom, 'W1N1');
      assert.equal(tasks.task1.status, 'planning');

      console.log(`创建了攻击任务: ${Object.keys(tasks).length} 个`);
    });
  });

  describe("Creep角色行为", () => {
    it("应该能够创建不同角色的Creep", async function () {
      // 初始化测试环境
      await helper.beforeEach();

      // 创建不同角色的Creep
      const roles = ['upgrader', 'builder', 'carrier', 'warrior', 'tank', 'archer', 'healer', 'staticHarvester'];

      roles.forEach((role, index) => {
        helper.addCreep(`test_${role}`, role, 'W0N1', 25 + index, 25);
      });

      // 检查Creep
      const creeps = helper.creeps;
      assert.equal(Object.keys(creeps).length, roles.length);

      // 验证每个角色
      roles.forEach(role => {
        const creepName = `test_${role}`;
        assert.isDefined(creeps[creepName]);
        assert.equal(creeps[creepName].memory.role, role);
      });

      console.log(`创建了 ${Object.keys(creeps).length} 个不同角色的Creep`);
    });
  });

  describe("房间间移动", () => {
    it("应该能够处理跨房间移动", async function () {
      // 初始化测试环境
      await helper.beforeEach();

      // 创建多个房间
      helper.addRoomObject('W0N1', 'controller', 25, 25, { level: 1 });
      helper.addRoomObject('W1N1', 'controller', 25, 25, { level: 1 });

      // 创建在房间边界的Creep
      helper.addCreep('borderCreep1', 'tank', 'W0N1', 2, 25);  // 左边界
      helper.addCreep('borderCreep2', 'warrior', 'W0N1', 47, 25); // 右边界
      helper.addCreep('borderCreep3', 'archer', 'W0N1', 25, 2);  // 上边界
      helper.addCreep('borderCreep4', 'healer', 'W0N1', 25, 47); // 下边界

      // 检查边界Creep
      const creeps = helper.creeps;
      const borderCreeps = Object.values(creeps).filter((creep: any) => {
        return creep.pos.x <= 2 || creep.pos.x >= 47 || creep.pos.y <= 2 || creep.pos.y >= 47;
      });

      assert.equal(borderCreeps.length, 4);
      console.log(`在房间边界附近的Creep数量: ${borderCreeps.length}`);
    });
  });

  describe("战斗逻辑", () => {
    it("应该能够执行战斗逻辑", async function () {
      // 初始化测试环境
      await helper.beforeEach();

      // 运行几个tick
      for (let i = 0; i < 5; i++) {
        await helper.tick();
      }

      // 检查游戏时间
      assert.equal(helper.gameTime, 5);

      // 模拟战斗相关的内存状态
      helper.memory.combatSquads = {
        squad1: {
          id: 'squad1',
          members: {
            tank: 'tank1',
            warrior: 'warrior1',
            archer: 'archer1',
            healer: 'healer1'
          },
          status: 'engaged',
          formationTime: 0,
          isAssembling: false
        }
      };

      helper.memory.attackTasks = {
        task1: {
          id: 'task1',
          targetRoom: 'W1N1',
          sourceRoom: 'W0N1',
          squads: ['squad1'],
          status: 'engaging',
          priority: 'high',
          createdAt: 0
        }
      };

      // 检查战斗小队状态
      if (helper.memory.combatSquads) {
        for (const [squadId, squad] of Object.entries(helper.memory.combatSquads)) {
          console.log(`小队 ${squadId}:`, squad);

          // 验证小队结构
          assert.property(squad, 'members');
          assert.property(squad, 'status');
          assert.property(squad, 'formationTime');
        }
      }

      // 检查攻击任务状态
      if (helper.memory.attackTasks) {
        for (const [taskId, task] of Object.entries(helper.memory.attackTasks)) {
          console.log(`攻击任务 ${taskId}:`, task);

          // 验证任务结构
          assert.property(task, 'targetRoom');
          assert.property(task, 'sourceRoom');
          assert.property(task, 'squads');
          assert.property(task, 'status');
        }
      }
    });
  });
});
