import { ErrorMapper } from "utils/ErrorMapper";
import { RoleUpgrader } from "roles/upgrader";
import { RoleStaticHarvester } from "roles/staticHarvester";
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
    staticHarvesters: number;
    upgraders: number;
    builders: number;
    carriers: number;
    miningSpots: string[]; // 新增：记录可用的采矿点
  }

  interface CreepMemory {
    role: string;
    room: string;
    working: boolean;
    sourceIndex?: number;  // 指定采集的资源点
    targetId?: string;     // 目标ID
    lastPos?: { x: number, y: number }; // 记录上一次位置，用于道路规划
  }
}

// 各角色需要的数量配置
const ROLE_LIMITS = {
  staticHarvester: 0,  // 静态矿工（根据采矿点数量动态调整）
  upgrader: 2,         // 升级者
  builder: 2,          // 建造者
  carrier: 2           // 运输者（增加数量以支持静态矿工）
};

// 生产新 Creep 的身体部件配置
const BODY_PARTS = {
  staticHarvester: [WORK, WORK, WORK], // 静态矿工只需要工作部件
  upgrader: [WORK, CARRY, MOVE, MOVE],
  builder: [WORK, CARRY, MOVE, MOVE],
  carrier: [CARRY, CARRY, MOVE, MOVE]
};

export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`=== Tick ${Game.time} ===`);

  // 初始化全局内存
  if (!Memory.rooms) {
    Memory.rooms = {};
  }

  // 调试信息：显示所有房间
  console.log(`总房间数量: ${Object.keys(Game.rooms).length}`);
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
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
      continue;
    }

    console.log(`处理我的房间: ${roomName}`);

    // 初始化房间内存
    if (!Memory.rooms[roomName]) {
      Memory.rooms[roomName] = {
        staticHarvesters: 0,
        upgraders: 0,
        builders: 0,
        carriers: 0,
        miningSpots: [] // 新增：记录可用的采矿点
      };
      console.log(`初始化房间 ${roomName} 的内存`);
    }

    // 更新采矿点信息
    updateMiningSpots(room);

    // 更新建筑布局建议
    updateBuildingLayout(room);

    // 更新道路规划
    updateRoadPlanning(room);

    // 更新任务系统
    updateTaskSystem(room);

    manageRoom(room);
  }

  // 如果没有我的房间，显示提示
  const myRooms = Object.values(Game.rooms).filter(room => room.controller?.my);

});

// 更新房间的采矿点信息
function updateMiningSpots(room: Room): void {
  const sources = room.find(FIND_SOURCES);
  const miningSpots: string[] = [];

  // 为每个资源点找到最近的可用位置
  for (const source of sources) {
    // 寻找资源点周围2格内的可用位置
    const positions = [];
    for (let x = source.pos.x - 2; x <= source.pos.x + 2; x++) {
      for (let y = source.pos.y - 2; y <= source.pos.y + 2; y++) {
        if (x >= 0 && x < 50 && y >= 0 && y < 50) {
          const pos = new RoomPosition(x, y, room.name);
          if (pos.isNearTo(source) && !pos.isNearTo(room.controller!)) {
            // 检查位置是否被占用
            const creepsAtPos = room.lookForAt(LOOK_CREEPS, pos);
            const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, pos);

            if (creepsAtPos.length === 0 && structuresAtPos.length === 0) {
              positions.push(pos);
            }
          }
        }
      }
    }

    if (positions.length > 0) {
      // 选择最近的可用位置
      const bestPos = positions.reduce((best, current) => {
        return current.getRangeTo(source) < best.getRangeTo(source) ? current : best;
      });
      miningSpots.push(`${bestPos.x},${bestPos.y}`);
    }
  }

  Memory.rooms[room.name].miningSpots = miningSpots;
}

// 更新房间的建筑布局建议
function updateBuildingLayout(room: Room): void {
  const sources = room.find(FIND_SOURCES);
  const extensions = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_EXTENSION
  });
  const containers = room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER
  });

  // 优先建造 Container（放在矿点周围，帮助收集资源）
  if (containers.length < sources.length) {
    const bestPos = findBestContainerPosition(room);
    if (bestPos) {
      room.createConstructionSite(bestPos.x, bestPos.y, STRUCTURE_CONTAINER);
    }
  }

  // 然后建造 Extension（贴着主城斜向扩展）
  if (extensions.length < 5) { // 限制 Extension 数量，避免过度拥挤
    const bestPos = findBestExtensionPosition(room);
    if (bestPos) {
      room.createConstructionSite(bestPos.x, bestPos.y, STRUCTURE_EXTENSION);
    }
  }
}

// 寻找扩展的最佳位置（贴着主城斜向扩展）
function findBestExtensionPosition(room: Room): RoomPosition | null {
  const spawns = room.find(FIND_MY_SPAWNS);
  if (spawns.length === 0) return null;

  const spawn = spawns[0]; // 使用第一个 spawn 作为参考点

  // 定义棋盘式斜向扩展的偏移量（#代表主城，x代表extension）
  // |---|----|----|----|----|
  // |x| |x| |x|
  // | |x| |x| |
  // |x| |#| |x|
  // | |x| |x| |
  // |x| |x| |x|
  const chessboardOffsets = [
    // 第一层：紧贴 spawn 的 4 个对角位置
    { x: -1, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 1 },  { x: 1, y: 1 },

    // 第二层：向外扩展的 8 个位置
    { x: -2, y: -2 }, { x: 0, y: -2 }, { x: 2, y: -2 },
    { x: -2, y: 0 },                    { x: 2, y: 0 },
    { x: -2, y: 2 },  { x: 0, y: 2 },  { x: 2, y: 2 },

    // 第三层：最外层的 4 个位置
    { x: -3, y: -1 }, { x: 3, y: -1 },
    { x: -3, y: 1 },  { x: 3, y: 1 }
  ];

  // 按照棋盘式布局顺序寻找可用位置
  for (const offset of chessboardOffsets) {
    const x = spawn.pos.x + offset.x;
    const y = spawn.pos.y + offset.y;

    if (x >= 0 && x < 50 && y >= 0 && y < 50) {
      const pos = new RoomPosition(x, y, room.name);

      // 检查位置是否可用
      const creepsAtPos = room.lookForAt(LOOK_CREEPS, pos);
      const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, pos);
      const constructionSitesAtPos = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);

      if (creepsAtPos.length === 0 &&
          structuresAtPos.length === 0 &&
          constructionSitesAtPos.length === 0) {
        return pos; // 返回第一个可用的位置，确保有序扩展
      }
    }
  }

  return null;
}

// 寻找容器的最佳位置（放在矿点周围）
function findBestContainerPosition(room: Room): RoomPosition | null {
  const sources = room.find(FIND_SOURCES);
  if (sources.length === 0) return null;

  // 为每个矿点寻找最佳的 Container 位置
  for (const source of sources) {
    const positions: RoomPosition[] = [];

    // 在矿点周围 2 格范围内寻找位置
    for (let x = source.pos.x - 2; x <= source.pos.x + 2; x++) {
      for (let y = source.pos.y - 2; y <= source.pos.y + 2; y++) {
        if (x >= 0 && x < 50 && y >= 0 && y < 50) {
          const pos = new RoomPosition(x, y, room.name);

          // 检查位置是否合适
          if (pos.isNearTo(source) && !pos.isEqualTo(source.pos)) {
            const creepsAtPos = room.lookForAt(LOOK_CREEPS, pos);
            const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, pos);
            const constructionSitesAtPos = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);

            if (creepsAtPos.length === 0 &&
                structuresAtPos.length === 0 &&
                constructionSitesAtPos.length === 0) {
              positions.push(pos);
            }
          }
        }
      }
    }

    if (positions.length > 0) {
      // 选择距离矿点最近的位置
      return positions.reduce((best, current) => {
        return current.getRangeTo(source) < best.getRangeTo(source) ? current : best;
      });
    }
  }

  return null;
}

// 更新道路规划
function updateRoadPlanning(room: Room): void {
  // 分析 Creep 移动路径，找出高频路径
  const highTrafficPaths = analyzeCreepMovement(room);

  // 为高频路径建造道路
  for (const path of highTrafficPaths) {
    if (shouldBuildRoad(room, path)) {
      room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
    }
  }
}

// 分析 Creep 移动路径
function analyzeCreepMovement(room: Room): RoomPosition[] {
  const creeps = room.find(FIND_MY_CREEPS);
  const pathCounts = new Map<string, number>();

  // 统计每个位置的访问频率
  for (const creep of creeps) {
    if (creep.memory.lastPos) {
      const path = getPathBetween(creep.memory.lastPos, creep.pos);
      for (const pos of path) {
        const key = `${pos.x},${pos.y}`;
        pathCounts.set(key, (pathCounts.get(key) || 0) + 1);
      }
    }

    // 记录当前位置
    creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
  }

  // 找出高频路径（访问次数 > 3 的位置）
  const highTrafficPositions: RoomPosition[] = [];
  for (const [key, count] of pathCounts) {
    if (count > 3) {
      const [x, y] = key.split(',').map(Number);
      highTrafficPositions.push(new RoomPosition(x, y, room.name));
    }
  }

  return highTrafficPositions;
}

// 获取两点间的路径
function getPathBetween(from: { x: number, y: number }, to: RoomPosition): RoomPosition[] {
  const path: RoomPosition[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);

  let currentX = from.x;
  let currentY = from.y;

  // 简单的直线路径算法
  while (currentX !== to.x || currentY !== to.y) {
    if (currentX !== to.x) {
      currentX += dx;
      path.push(new RoomPosition(currentX, currentY, to.roomName));
    }
    if (currentY !== to.y) {
      currentY += dy;
      path.push(new RoomPosition(currentX, currentY, to.roomName));
    }
  }

  return path;
}

// 判断是否应该建造道路
function shouldBuildRoad(room: Room, position: RoomPosition): boolean {
  // 检查位置是否已经有道路
  const structures = room.lookForAt(LOOK_STRUCTURES, position);
  if (structures.some(s => s.structureType === STRUCTURE_ROAD)) {
    return false;
  }

  // 检查位置是否被其他建筑占用
  if (structures.length > 0) {
    return false;
  }

  // 检查位置是否被 Creep 占用
  const creeps = room.lookForAt(LOOK_CREEPS, position);
  if (creeps.length > 0) {
    return false;
  }

  // 检查是否有足够的能量建造道路
  if (room.energyAvailable < 300) {
    return false;
  }

  return true;
}

function manageRoom(room: Room): void {
  // 统计当前各角色数量
  const creepCounts = {
    harvester: 0,
    staticHarvester: 0,
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

  // 检查是否已建立基础兵种
  const hasBasic = hasBasicCreeps(creepCounts);

  // 尝试生产新 Creep
  spawnCreeps(room, creepCounts, hasBasic);

  // 管理静态矿工的放置
  manageStaticHarvesters(room);

  // 运行每个 Creep 的逻辑
  for (const creep of roomCreeps) {
    runCreepRole(creep);
  }
}

// 管理静态矿工
function manageStaticHarvesters(room: Room): void {
  const staticHarvesters = room.find(FIND_MY_CREEPS, {
    filter: creep => creep.memory.role === 'staticHarvester'
  });

  // 获取所有采矿点
  const miningSpots = Memory.rooms[room.name].miningSpots;

  // 为每个静态矿工分配采矿点
  for (const harvester of staticHarvesters) {
    if (!harvester.memory.targetId) {
      // 寻找可用的采矿点（没有被其他 creep 占用的）
      let bestSpot: string | null = null;
      let bestDistance = Infinity;

      for (const spot of miningSpots) {
        const [x, y] = spot.split(',').map(Number);
        const spotPos = new RoomPosition(x, y, room.name);

        // 检查这个位置是否已经被其他 creep 占用
        const creepsAtSpot = room.lookForAt(LOOK_CREEPS, spotPos);
        const isOccupied = creepsAtSpot.some(c => c.id !== harvester.id);

        if (!isOccupied) {
          const distance = harvester.pos.getRangeTo(spotPos);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestSpot = spot;
          }
        }
      }

      if (bestSpot) {
        harvester.memory.targetId = bestSpot;
        console.log(`静态矿工 ${harvester.name} 分配到采矿点: ${bestSpot}`);
      }
    }
  }
}

function spawnCreeps(room: Room, creepCounts: any, hasBasic: boolean): void {
  const spawns = room.find(FIND_MY_SPAWNS);
  const availableSpawn = spawns.find(spawn => !spawn.spawning);

  if (!availableSpawn) {
    return;
  }

  // 检查房间能量状态
  const roomEnergy = room.energyAvailable;
  const roomEnergyCapacity = room.energyCapacityAvailable;

  // 动态调整静态矿工数量限制
  const miningSpots = Memory.rooms[room.name].miningSpots;
  const dynamicRoleLimits = {
    ...ROLE_LIMITS,
    staticHarvester: Math.max(0, miningSpots.length) // 根据采矿点数量调整静态矿工数量
  };

  // 根据基础兵种状态调整生产策略
  let priorities: string[];
  if (!hasBasic) {
    // 还没有建立基础兵种，优先生产缺失的
    priorities = getSpawnPriorities(room, creepCounts, roomEnergy);
  } else {
    // 已建立基础兵种，建筑者和升级工可以开始工作
    // 优先生产更多运输兵和矿工，然后是建筑者和升级工
    priorities = ['carrier',  'staticHarvester', 'upgrader', 'builder'];
  }

  for (const role of priorities) {
    if (creepCounts[role] < dynamicRoleLimits[role as keyof typeof dynamicRoleLimits]) {
      // 根据可用能量选择身体部件
      const bodyParts = getOptimalBodyParts(role, roomEnergy);

      if (bodyParts.length === 0) {
        continue;
      }

      const name = `${role}_${Game.time}_${Math.floor(Math.random() * 1000)}`;

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
        return;
      } else {
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
  // 基础优先级：先保证每个兵种都有一个
  const basePriorities = ['carrier', 'staticHarvester', 'upgrader', 'builder'];

  // 检查哪些兵种还没有
  const missingRoles: string[] = [];
  for (const role of basePriorities) {
    if (creepCounts[role] === 0) {
      missingRoles.push(role);
    }
  }

  // 如果有缺失的兵种，优先生产缺失的
  if (missingRoles.length > 0) {
    return missingRoles;
  }

  // 如果所有兵种都有至少一个，按优先级继续生产
  const normalPriorities = ['carrier', 'staticHarvester', 'upgrader', 'builder'];

  // 如果没有运输者，优先生产
  if (creepCounts.carrier === 0) {
    return ['carrier', 'staticHarvester', 'upgrader', 'builder'];
  }

  // 如果有采矿点且缺少静态矿工，优先生产
  const miningSpots = Memory.rooms[room.name].miningSpots;
  if (miningSpots.length > 0 && creepCounts.staticHarvester < miningSpots.length - 1) {
    return ['staticHarvester', 'carrier', 'upgrader', 'builder'];
  }

  // 如果控制器等级较低，优先升级
  if (room.controller && room.controller.level < 3) {
    return ['upgrader', 'staticHarvester', 'carrier', 'builder'];
  }

  // 如果有建筑任务，优先建造者
  const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
  if (constructionSites.length > 0) {
    return ['builder', 'staticHarvester', 'carrier', 'upgrader'];
  }

  return normalPriorities;
}

// 检查房间是否已经建立了基础兵种
function hasBasicCreeps(creepCounts: any): boolean {
  return creepCounts.carrier > 0 &&
         creepCounts.staticHarvester > 0 &&
         creepCounts.upgrader > 0 &&
         creepCounts.builder > 0;
}

// 根据可用能量获取最优身体部件
function getOptimalBodyParts(role: string, availableEnergy: number): BodyPartConstant[] {
  const baseConfigs = {
    staticHarvester: [
      [WORK],                                 // 100 能量
      [WORK, WORK],                           // 200 能量
      [WORK, WORK, WORK]                      // 300 能量
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
    case 'staticHarvester':
      RoleStaticHarvester.run(creep);
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
      // 未知角色，静默处理
      break;
  }
}

// 任务系统：协调 Carrier 和静态矿工
function updateTaskSystem(room: Room): void {
  // 检查是否有需要帮助的静态矿工
  const staticHarvesters = room.find(FIND_MY_CREEPS, {
    filter: creep => creep.memory.role === 'staticHarvester'
  });

  const carriers = room.find(FIND_MY_CREEPS, {
    filter: creep => creep.memory.role === 'carrier'
  });

  // 为需要帮助的静态矿工分配 Carrier
  for (const harvester of staticHarvesters) {
    if (harvester.memory.targetId && !harvester.pos.isEqualTo(new RoomPosition(
      parseInt(harvester.memory.targetId.split(',')[0]),
      parseInt(harvester.memory.targetId.split(',')[1]),
      harvester.room.name
    ))) {
      // 寻找空闲的 Carrier 来帮助
      const availableCarrier = carriers.find(carrier =>
        !carrier.memory.working &&
        carrier.store.getUsedCapacity() === 0 &&
        !carrier.memory.targetId
      );

      if (availableCarrier) {
        availableCarrier.memory.targetId = harvester.id;
        availableCarrier.say('🚶 帮助移动');
      }
    }
  }

  // 清理已完成的任务
  for (const carrier of carriers) {
    if (carrier.memory.targetId && carrier.memory.targetId.startsWith('staticHarvester_')) {
      const targetHarvester = Game.getObjectById(carrier.memory.targetId) as Creep;
      if (!targetHarvester || targetHarvester.memory.role !== 'staticHarvester') {
        delete carrier.memory.targetId;
      }
    }
  }
}
