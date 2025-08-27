import { ErrorMapper } from "utils/ErrorMapper";
import { initializeRoomMemory, cleanupDeadCreeps, updateRoomStatus, manageRoom } from "./managers/roomManager";

// 导入控制台命令
import * as ConsoleCommands from "./utils/consoleCommands";

// 导入攻击管理器函数
import { manualAttack, assessRoomForAttack, executeAttackTask } from "./managers/attackManager";
import { getRoomCombatSquads, forceUpdateSquadStatus } from "./managers/combatManager";

// 导入攻击评估配置
import { ATTACK_ASSESSMENT_CONFIG } from "./config/combatConfig";

// 将控制台命令暴露到全局作用域
declare global {
  var attack: typeof ConsoleCommands.attack;
  var showAttackTasks: typeof ConsoleCommands.showAttackTasks;
  var cancelAttack: typeof ConsoleCommands.cancelAttack;
  var showCombatSquads: typeof ConsoleCommands.showCombatSquads;
  var assessRoom: typeof ConsoleCommands.assessRoom;
  var forceRetreat: typeof ConsoleCommands.forceRetreat;
  var help: typeof ConsoleCommands.help;
  var forceAttack: typeof ConsoleCommands.forceAttack;
  var createSquad: typeof ConsoleCommands.createSquad;
  var refillSquad: typeof ConsoleCommands.refillSquad;
  var forceUpdateSquad: typeof ConsoleCommands.forceUpdateSquad;
  var showTasks: typeof ConsoleCommands.showTasks;
  var cleanupTasks: typeof ConsoleCommands.cleanupTasks;
  var forceAssignTasks: typeof ConsoleCommands.forceAssignTasks;
  var showTaskAssignmentStatus: typeof ConsoleCommands.showTaskAssignmentStatus;

  // 暴露攻击管理器函数
  var manualAttack: (sourceRoom: Room, targetRoom: string) => string | null;
  var assessRoomForAttack: (roomName: string) => any;
  var getRoomCombatSquads: (room: Room) => any[];
  var executeAttackTask: (taskId: string) => void;
  var forceUpdateSquadStatus: (squadId: string) => void;

  // 暴露攻击评估配置
  var ATTACK_ASSESSMENT_CONFIG: any;
}

// 暴露控制台命令到全局
global.attack = ConsoleCommands.attack;
global.showAttackTasks = ConsoleCommands.showAttackTasks;
global.cancelAttack = ConsoleCommands.cancelAttack;
global.showCombatSquads = ConsoleCommands.showCombatSquads;
global.assessRoom = ConsoleCommands.assessRoom;
global.forceRetreat = ConsoleCommands.forceRetreat;
global.help = ConsoleCommands.help;
global.forceAttack = ConsoleCommands.forceAttack;
global.createSquad = ConsoleCommands.createSquad;
global.refillSquad = ConsoleCommands.refillSquad;
global.forceUpdateSquad = ConsoleCommands.forceUpdateSquad;
global.showTasks = ConsoleCommands.showTasks;
global.cleanupTasks = ConsoleCommands.cleanupTasks;
global.forceAssignTasks = ConsoleCommands.forceAssignTasks;
global.showTaskAssignmentStatus = ConsoleCommands.showTaskAssignmentStatus;

// 暴露攻击管理器函数到全局
global.manualAttack = manualAttack;
global.assessRoomForAttack = assessRoomForAttack;
global.getRoomCombatSquads = getRoomCombatSquads;
global.executeAttackTask = executeAttackTask;
global.forceUpdateSquadStatus = forceUpdateSquadStatus;

// 暴露攻击评估配置到全局
global.ATTACK_ASSESSMENT_CONFIG = ATTACK_ASSESSMENT_CONFIG;

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
