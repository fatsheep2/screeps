import { ErrorMapper } from "utils/ErrorMapper";
import { initializeRoomMemory, cleanupDeadCreeps, updateRoomStatus, manageRoom } from "./managers/roomManager";

// 导入控制台命令
import * as ConsoleCommands from "./utils/consoleCommands";

// 导入攻击管理器函数
import { manualAttack, assessRoomForAttack } from "./managers/attackManager";

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

  // 暴露攻击管理器函数
  var manualAttack: (sourceRoom: Room, targetRoom: string) => string | null;
  var assessRoomForAttack: (roomName: string) => any;

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

// 暴露攻击管理器函数到全局
global.manualAttack = manualAttack;
global.assessRoomForAttack = assessRoomForAttack;

// 暴露攻击评估配置到全局
global.ATTACK_ASSESSMENT_CONFIG = ATTACK_ASSESSMENT_CONFIG;

export const loop = ErrorMapper.wrapLoop(() => {
  // 初始化全局内存
  if (!Memory.rooms) {
    Memory.rooms = {};
  }

  // 清理已死亡 Creep 的内存
  cleanupDeadCreeps();

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
