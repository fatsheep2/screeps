import { ErrorMapper } from "utils/ErrorMapper";
import { manageRoom } from "./managers/roomManager";

// 导入简化的控制台命令
import * as ConsoleCommands from "./utils/consoleCommands";

// 导入搬运工诊断工具
import { CarrierDiagnostics } from "./utils/carrierDiagnostics";

// 导入任务系统调试工具
import { TaskDebug } from "./utils/taskDebug";


// 导入战斗相关角色（用于跨房间处理）
import { RoleTank } from "./roles/tank";
import { RoleWarrior } from "./roles/warrior";
import { RoleArcher } from "./roles/archer";
import { RoleHealer } from "./roles/healer";
import { RoleScout } from "./roles/scout";

// 将简化的控制台命令暴露到全局作用域
declare global {
  var attack: typeof ConsoleCommands.attack;
  var testMove: typeof ConsoleCommands.testMove;
  var showTanks: typeof ConsoleCommands.showTanks;
  var stopAttack: typeof ConsoleCommands.stopAttack;
  var help: typeof ConsoleCommands.help;
  var clearMoveCache: typeof ConsoleCommands.clearMoveCache;
  var clearAllTankCache: typeof ConsoleCommands.clearAllTankCache;
  var checkRoomConnection: typeof ConsoleCommands.checkRoomConnection;
  var checkStaticWorkers: typeof ConsoleCommands.checkStaticWorkers;
  var diagnosePull: typeof ConsoleCommands.diagnosePull;


  // 搬运工诊断命令
  var diagnoseCarriers: typeof CarrierDiagnostics.fullDiagnosis;
  var analyzeCarrier: typeof CarrierDiagnostics.analyzeCarrierDetailed;
  var forceAssignTasks: typeof CarrierDiagnostics.forceTaskReassignment;

  // 任务系统调试命令
  var showTasks: typeof TaskDebug.showAllTasks;
  var clearTasks: typeof TaskDebug.clearAllTasks;
  var testComplete: typeof TaskDebug.testTaskCompletion;
  var checkExtensions: typeof TaskDebug.checkExtensions;
  var diagnoseCarrierTasks: typeof TaskDebug.diagnoseCrackCarriers;
  var diagnoseSupplyLoop: typeof ConsoleCommands.diagnoseSupplyLoop;
  var fixStuckSupplyTasks: typeof ConsoleCommands.fixStuckSupplyTasks;
}

// 暴露简化的控制台命令到全局
global.attack = ConsoleCommands.attack;
global.testMove = ConsoleCommands.testMove;
global.showTanks = ConsoleCommands.showTanks;
global.stopAttack = ConsoleCommands.stopAttack;
global.help = ConsoleCommands.help;
global.clearMoveCache = ConsoleCommands.clearMoveCache;
global.clearAllTankCache = ConsoleCommands.clearAllTankCache;
global.checkRoomConnection = ConsoleCommands.checkRoomConnection;
global.checkStaticWorkers = ConsoleCommands.checkStaticWorkers;
global.diagnosePull = ConsoleCommands.diagnosePull;


// 暴露搬运工诊断命令
global.diagnoseCarriers = CarrierDiagnostics.fullDiagnosis;
global.analyzeCarrier = CarrierDiagnostics.analyzeCarrierDetailed;
global.forceAssignTasks = CarrierDiagnostics.forceTaskReassignment;

// 暴露任务系统调试命令
global.showTasks = TaskDebug.showAllTasks;
global.clearTasks = TaskDebug.clearAllTasks;
global.testComplete = TaskDebug.testTaskCompletion;
global.checkExtensions = TaskDebug.checkExtensions;
global.diagnoseCarrierTasks = TaskDebug.diagnoseCrackCarriers;
global.diagnoseSupplyLoop = ConsoleCommands.diagnoseSupplyLoop;
global.fixStuckSupplyTasks = ConsoleCommands.fixStuckSupplyTasks;

// 简化的内联函数实现
function cleanupDeadCreeps(): void {
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}

function initializeRoomMemory(room: Room): void {
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
}

function updateRoomStatus(room: Room): void {
  // 简化的房间状态更新，大部分逻辑已转移到各个管理器中
  const roomMemory = Memory.rooms[room.name];
  if (!roomMemory) return;
}

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

  // 全局creep处理：确保所有creep无论在哪个房间都能运行
  // 这样解决tank跨房间移动时逻辑不运行的问题
  for (const creepName in Game.creeps) {
    const creep = Game.creeps[creepName];
    // 检查creep是否在己方房间中已被处理过
    const isInMyRoom = creep.room.controller?.my;

    if (!isInMyRoom) {
      // creep在非己方房间，需要单独处理战斗角色
      try {
        const role = (creep.memory as any).role;
        switch (role) {
          case 'tank':
            RoleTank.run(creep);
            break;
          case 'warrior':
            RoleWarrior.run(creep);
            break;
          case 'archer':
            RoleArcher.run(creep);
            break;
          case 'healer':
            RoleHealer.run(creep);
            break;
          case 'scout':
            RoleScout.run(creep);
            break;
          // 其他角色通常不需要跨房间，暂不处理
        }
      } catch (error) {
        console.log(`全局处理 Creep ${creep.name} 角色 ${(creep.memory as any).role} 时发生错误: ${error}`);
      }
    }
  }

  // 如果没有我的房间，显示提示
  const myRooms = Object.values(Game.rooms).filter(room => room.controller?.my);
  if (myRooms.length === 0) {
    console.log('没有找到我的房间');
  }
});
