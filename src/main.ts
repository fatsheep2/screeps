import { ErrorMapper } from "utils/ErrorMapper";
import { RoleHarvester } from "roles/harvester";
import { RoleUpgrader } from "roles/upgrader";
import { RoleBuilder } from "roles/builder";
import { RoleCarrier } from "roles/carrier";

// 扩展全局类型
declare global {
  interface Memory {
    uuid: number;
    log: any;
    rooms: { [roomName: string]: RoomMemory };
  }

  interface RoomMemory {
    harvesters: number;
    upgraders: number;
    builders: number;
    carriers: number;
  }

  interface CreepMemory {
    role: string;
    room: string;
    working: boolean;
    sourceIndex?: number;  // 指定采集的资源点
    targetId?: string;     // 目标ID
  }
}

// 各角色需要的数量配置
const ROLE_LIMITS = {
  harvester: 2,   // 采集者
  upgrader: 2,    // 升级者
  builder: 2,     // 建造者
  carrier: 1      // 运输者
};

// 生产新 Creep 的身体部件配置
const BODY_PARTS = {
  harvester: [WORK, CARRY, MOVE],
  upgrader: [WORK, CARRY, MOVE, MOVE],
  builder: [WORK, CARRY, MOVE, MOVE],
  carrier: [CARRY, CARRY, MOVE, MOVE]
};

export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`=== Tick ${Game.time} ===`);

  // 初始化全局内存
  if (!Memory.rooms) {
    Memory.rooms = {};
    console.log('初始化全局房间内存');
  }

  // 调试信息：显示所有房间
  console.log(`总房间数量: ${Object.keys(Game.rooms).length}`);
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    console.log(`房间: ${roomName}, 控制器: ${room.controller ? room.controller.owner?.username : '无控制器'}, 是否我的: ${room.controller?.my || false}`);
  }

  // 清理已死亡 Creep 的内存
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      console.log(`清理已死亡的 Creep: ${name}`);
    }
  }

  // 遍历每个房间
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];

    // 跳过非己方房间
    if (!room.controller || !room.controller.my) {
      console.log(`跳过房间 ${roomName}: 控制器不存在或不是我的`);
      continue;
    }

    console.log(`处理我的房间: ${roomName}`);

    // 初始化房间内存
    if (!Memory.rooms[roomName]) {
      Memory.rooms[roomName] = {
        harvesters: 0,
        upgraders: 0,
        builders: 0,
        carriers: 0
      };
      console.log(`初始化房间 ${roomName} 的内存`);
    }

    manageRoom(room);
  }

  // 如果没有我的房间，显示提示
  const myRooms = Object.values(Game.rooms).filter(room => room.controller?.my);
  if (myRooms.length === 0) {
    console.log(`⚠️ 警告: 没有找到我的房间！请确保您已经占领了房间控制器。`);
  }
});

function manageRoom(room: Room): void {
  console.log(`管理房间: ${room.name}`);

  // 统计当前各角色数量
  const creepCounts = {
    harvester: 0,
    upgrader: 0,
    builder: 0,
    carrier: 0
  };

  // 统计房间内的 Creep
  const roomCreeps = room.find(FIND_MY_CREEPS);
  for (const creep of roomCreeps) {
    const role = creep.memory.role;
    if (role in creepCounts) {
      creepCounts[role as keyof typeof creepCounts]++;
    }
  }

  console.log(`当前 Creep 数量: H:${creepCounts.harvester} U:${creepCounts.upgrader} B:${creepCounts.builder} C:${creepCounts.carrier}`);

  // 尝试生产新 Creep
  spawnCreeps(room, creepCounts);

  // 运行每个 Creep 的逻辑
  for (const creep of roomCreeps) {
    runCreepRole(creep);
  }
}

function spawnCreeps(room: Room, creepCounts: any): void {
  const spawns = room.find(FIND_MY_SPAWNS);
  const availableSpawn = spawns.find(spawn => !spawn.spawning);

  if (!availableSpawn) {
    console.log(`房间 ${room.name} 没有可用的 Spawn`);
    return;
  }

  // 检查房间能量状态
  const roomEnergy = room.energyAvailable;
  const roomEnergyCapacity = room.energyCapacityAvailable;

  console.log(`房间 ${room.name} 能量: ${roomEnergy}/${roomEnergyCapacity}`);

  // 动态优先级系统：根据房间状态调整优先级
  const priorities = getSpawnPriorities(room, creepCounts, roomEnergy);

  for (const role of priorities) {
    if (creepCounts[role] < ROLE_LIMITS[role as keyof typeof ROLE_LIMITS]) {
      // 根据可用能量选择身体部件
      const bodyParts = getOptimalBodyParts(role, roomEnergy);

      if (bodyParts.length === 0) {
        console.log(`能量不足，无法生产 ${role}，需要 ${getBodyCost(bodyParts)} 能量`);
        continue;
      }

      const name = `${role}_${Game.time}_${Math.floor(Math.random() * 1000)}`;

      console.log(`尝试生产 ${role}: ${name}，身体部件: ${bodyParts.join(',')}`);

      const result = availableSpawn.spawnCreep(bodyParts, name, {
        memory: {
          role: role,
          room: room.name,
          working: false,
          sourceIndex: undefined,
          targetId: undefined
        }
      });

      if (result === OK) {
        console.log(`✅ 成功生产 ${role}: ${name}`);
        return;
      } else {
        console.log(`❌ 生产 ${role} 失败: ${getErrorMessage(result)}`);
        // 如果是能量不足，尝试下一个角色
        if (result === ERR_NOT_ENOUGH_ENERGY) {
          continue;
        }
        // 其他错误则停止尝试
        break;
      }
    }
  }
}

// 根据房间状态动态调整生产优先级
function getSpawnPriorities(room: Room, creepCounts: any, roomEnergy: number): string[] {
  const priorities = ['harvester', 'carrier', 'upgrader', 'builder'];

  // 如果能量严重不足，优先生产采集者
  if (roomEnergy < 300) {
    return ['harvester', 'carrier', 'upgrader', 'builder'];
  }

  // 如果没有采集者，优先生产
  if (creepCounts.harvester === 0) {
    return ['harvester', 'carrier', 'upgrader', 'builder'];
  }

  // 如果没有运输者，优先生产
  if (creepCounts.carrier === 0) {
    return ['carrier', 'harvester', 'upgrader', 'builder'];
  }

  // 如果控制器等级较低，优先升级
  if (room.controller && room.controller.level < 3) {
    return ['upgrader', 'harvester', 'carrier', 'builder'];
  }

  // 如果有建筑任务，优先建造者
  const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
  if (constructionSites.length > 0) {
    return ['builder', 'harvester', 'carrier', 'upgrader'];
  }

  return priorities;
}

// 根据可用能量获取最优身体部件
function getOptimalBodyParts(role: string, availableEnergy: number): BodyPartConstant[] {
  const baseConfigs = {
    harvester: [
      [WORK, CARRY, MOVE],                    // 300 能量
      [WORK, WORK, CARRY, MOVE],              // 400 能量
      [WORK, WORK, CARRY, CARRY, MOVE, MOVE] // 500 能量
    ],
    upgrader: [
      [WORK, CARRY, MOVE],                    // 300 能量
      [WORK, WORK, CARRY, MOVE, MOVE],       // 450 能量
      [WORK, WORK, WORK, CARRY, MOVE, MOVE]  // 550 能量
    ],
    builder: [
      [WORK, CARRY, MOVE],                    // 300 能量
      [WORK, WORK, CARRY, MOVE, MOVE],       // 450 能量
      [WORK, WORK, CARRY, CARRY, MOVE, MOVE] // 500 能量
    ],
    carrier: [
      [CARRY, CARRY, MOVE],                   // 150 能量
      [CARRY, CARRY, CARRY, CARRY, MOVE],    // 250 能量
      [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE] // 300 能量
    ]
  };

  const configs = baseConfigs[role as keyof typeof baseConfigs];
  if (!configs) return [];

  // 选择能量消耗不超过可用能量的最大配置
  for (let i = configs.length - 1; i >= 0; i--) {
    const cost = getBodyCost(configs[i]);
    if (cost <= availableEnergy) {
      return configs[i];
    }
  }

  return [];
}

// 计算身体部件的能量消耗
function getBodyCost(bodyParts: BodyPartConstant[]): number {
  const costs = {
    [WORK]: 100,
    [CARRY]: 50,
    [MOVE]: 50,
    [ATTACK]: 80,
    [RANGED_ATTACK]: 150,
    [HEAL]: 250,
    [CLAIM]: 600,
    [TOUGH]: 10
  };

  return bodyParts.reduce((total, part) => total + (costs[part] || 0), 0);
}

// 获取错误信息的友好描述
function getErrorMessage(result: number): string {
  const errorMessages: { [key: number]: string } = {
    [ERR_NOT_OWNER]: '不是房间的所有者',
    [ERR_NAME_EXISTS]: '名称已存在',
    [ERR_BUSY]: 'Spawn 正忙',
    [ERR_NOT_ENOUGH_ENERGY]: '能量不足',
    [ERR_INVALID_ARGS]: '参数无效',
    [ERR_RCL_NOT_ENOUGH]: '房间控制器等级不足'
  };

  return errorMessages[result] || `未知错误 (${result})`;
}

function runCreepRole(creep: Creep): void {
  switch (creep.memory.role) {
    case 'harvester':
      RoleHarvester.run(creep);
      break;
    case 'upgrader':
      RoleUpgrader.run(creep);
      break;
    case 'builder':
      RoleBuilder.run(creep);
      break;
    case 'carrier':
      RoleCarrier.run(creep);
      break;
    default:
      console.log(`未知的角色: ${creep.memory.role}`);
  }
}
