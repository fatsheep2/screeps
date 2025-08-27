import {assert} from "chai";
import {helper} from "./helper";

describe("简化集成测试", () => {
  describe("基础功能", () => {
    it("应该能运行游戏tick", async function () {
      for (let i = 1; i <= 5; i++) {
        assert.equal(helper.gameTime, i - 1);
        await helper.tick();
        assert.equal(helper.gameTime, i);
      }
    });

    it("应该能管理内存", async function () {
      // 设置内存
      helper.memory.foo = 'bar';
      assert.equal(helper.memory.foo, 'bar');

      // 清理内存
      helper.memory = { creeps: {}, rooms: {} };
      assert.isUndefined(helper.memory.foo);
    });
  });

  describe("Creep管理", () => {
    it("应该能够创建和管理Creep", async function () {
      // 创建一些测试Creep
      helper.addCreep('test1', 'upgrader', 'W0N1', 25, 25);
      helper.addCreep('test2', 'builder', 'W0N1', 26, 25);
      helper.addCreep('test3', 'tank', 'W0N1', 25, 26);

      // 检查Creep是否被创建
      const creeps = helper.creeps;
      assert.equal(Object.keys(creeps).length, 3);

      // 检查特定Creep
      assert.equal(creeps.test1.memory.role, 'upgrader');
      assert.equal(creeps.test2.memory.role, 'builder');
      assert.equal(creeps.test3.memory.role, 'tank');

      console.log(`创建了 ${Object.keys(creeps).length} 个Creep`);
    });

    it("应该能够访问Creep内存", async function () {
      // 创建Creep
      helper.addCreep('memoryTest', 'carrier', 'W0N1', 25, 25);

      // 检查内存
      const creep = helper.creeps.memoryTest;
      assert.equal(creep.memory.role, 'carrier');
      assert.equal(creep.memory.room, 'W0N1');
      assert.equal(creep.memory.working, false);

      // 修改内存
      creep.memory.working = true;
      assert.equal(creep.memory.working, true);
    });
  });

  describe("房间管理", () => {
    it("应该能够管理房间", async function () {
      // 检查基础房间
      const rooms = helper.rooms;
      assert.isDefined(rooms.W0N1);
      assert.equal(rooms.W0N1.name, 'W0N1');
      assert.equal(rooms.W0N1.energyAvailable, 300);

      // 添加新房间
      helper.addRoomObject('W1N1', 'controller', 25, 25, { level: 1 });
      assert.isDefined(rooms.W1N1);
    });

    it("应该能够添加房间对象", async function () {
      // 添加建筑工地
      const constructionSite = helper.addRoomObject('W0N1', 'constructionSite', 30, 30, {
        structureType: 'extension',
        user: 'player'
      });

      assert.isDefined(constructionSite);
      assert.equal(constructionSite.type, 'constructionSite');
      assert.equal(constructionSite.room, 'W0N1');
      assert.equal(constructionSite.x, 30);
      assert.equal(constructionSite.y, 30);
    });
  });

  describe("游戏循环", () => {
    it("应该能够模拟游戏逻辑", async function () {
      // 创建一些Creep
      helper.addCreep('gameLoopTest1', 'upgrader', 'W0N1', 25, 25);
      helper.addCreep('gameLoopTest2', 'tank', 'W0N1', 26, 25);

      // 运行几个tick
      for (let i = 0; i < 3; i++) {
        await helper.tick();
      }

      // 检查游戏时间
      assert.equal(helper.gameTime, 3);

      // 检查Creep仍然存在
      assert.isDefined(helper.creeps.gameLoopTest1);
      assert.isDefined(helper.creeps.gameLoopTest2);
    });
  });
});
