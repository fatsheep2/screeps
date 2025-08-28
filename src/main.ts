import { ErrorMapper } from "utils/ErrorMapper";
import { initializeRoomMemory, cleanupDeadCreeps, updateRoomStatus, manageRoom } from "./managers/roomManager";

// 导入简化的控制台命令
import * as ConsoleCommands from "./utils/consoleCommands";

// 导入跨房间移动测试工具
import { CrossRoomMovementTest } from "./utils/crossRoomTest";

// 导入集成测试套件
import { CrossRoomIntegrationTest } from "./tests/crossRoomIntegrationTest";

// 导入搬运工诊断工具
import { CarrierDiagnostics } from "./utils/carrierDiagnostics";

// 将简化的控制台命令暴露到全局作用域
declare global {
  var attack: typeof ConsoleCommands.attack;
  var testMove: typeof ConsoleCommands.testMove;
  var showTanks: typeof ConsoleCommands.showTanks;
  var stopAttack: typeof ConsoleCommands.stopAttack;
  var help: typeof ConsoleCommands.help;

  // 跨房间移动测试命令
  var startCrossRoomTest: typeof CrossRoomMovementTest.startTest;
  var checkTest: typeof CrossRoomMovementTest.checkTest;
  var debugTest: typeof CrossRoomMovementTest.debugTest;
  var stopTest: typeof CrossRoomMovementTest.stopTest;
  var batchTest: typeof CrossRoomMovementTest.batchTest;
  var checkBatchTest: typeof CrossRoomMovementTest.checkBatchTest;

  // 集成测试命令
  var runIntegrationTest: typeof CrossRoomIntegrationTest.runFullTestSuite;
  var checkIntegrationTest: typeof CrossRoomIntegrationTest.checkIntegrationTest;
  var cleanupIntegrationTests: typeof CrossRoomIntegrationTest.cleanupIntegrationTests;

  // 搬运工诊断命令
  var diagnoseCarriers: typeof CarrierDiagnostics.fullDiagnosis;
  var analyzeCarrier: typeof CarrierDiagnostics.analyzeCarrierDetailed;
  var forceAssignTasks: typeof CarrierDiagnostics.forceTaskReassignment;
}

// 暴露简化的控制台命令到全局
global.attack = ConsoleCommands.attack;
global.testMove = ConsoleCommands.testMove;
global.showTanks = ConsoleCommands.showTanks;
global.stopAttack = ConsoleCommands.stopAttack;
global.help = ConsoleCommands.help;

// 暴露跨房间移动测试命令
global.startCrossRoomTest = CrossRoomMovementTest.startTest;
global.checkTest = CrossRoomMovementTest.checkTest;
global.debugTest = CrossRoomMovementTest.debugTest;
global.stopTest = CrossRoomMovementTest.stopTest;
global.batchTest = CrossRoomMovementTest.batchTest;
global.checkBatchTest = CrossRoomMovementTest.checkBatchTest;

// 暴露集成测试命令
global.runIntegrationTest = CrossRoomIntegrationTest.runFullTestSuite;
global.checkIntegrationTest = CrossRoomIntegrationTest.checkIntegrationTest;
global.cleanupIntegrationTests = CrossRoomIntegrationTest.cleanupIntegrationTests;

// 暴露搬运工诊断命令
global.diagnoseCarriers = CarrierDiagnostics.fullDiagnosis;
global.analyzeCarrier = CarrierDiagnostics.analyzeCarrierDetailed;
global.forceAssignTasks = CarrierDiagnostics.forceTaskReassignment;

export const loop = ErrorMapper.wrapLoop(() => {
  // 初始化全局内存
  if (!Memory.rooms) {
    Memory.rooms = {};
  }

  // 清理已死亡 Creep 的内存
  cleanupDeadCreeps();

  // 定期清理过期任务（每100个tick执行一次）
  if (Game.time % 100 === 0) {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller && room.controller.my) {
        try {
          const { getRoomTaskManager } = require('./managers/taskManager');
          const taskManager = getRoomTaskManager(roomName);
          if (taskManager && typeof (taskManager as any).cleanupTasks === 'function') {
            (taskManager as any).cleanupTasks();
          }
        } catch (error) {
          // 忽略错误
        }
      }
    }
  }

  // 遍历每个房间
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];

    // 跳过非己方房间
    if (!room.controller || !room.controller.my) {
      continue;
    }

    // 初始化房间内存
    initializeRoomMemory(room);

    // 更新房间状态
    updateRoomStatus(room);

    // 管理房间
    manageRoom(room);
  }

  // 如果没有我的房间，显示提示
  const myRooms = Object.values(Game.rooms).filter(room => room.controller?.my);
  if (myRooms.length === 0) {
    console.log('没有找到我的房间');
  }
});
