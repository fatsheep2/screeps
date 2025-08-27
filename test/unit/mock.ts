// Screeps 全局常量
export const WORK = 'work';
export const CARRY = 'carry';
export const MOVE = 'move';
export const ATTACK = 'attack';
export const RANGED_ATTACK = 'ranged_attack';
export const HEAL = 'heal';
export const CLAIM = 'claim';
export const TOUGH = 'tough';

// Screeps 错误代码
export const OK = 0;
export const ERR_NOT_OWNER = -1;
export const ERR_NO_PATH = -2;
export const ERR_NAME_EXISTS = -3;
export const ERR_BUSY = -4;
export const ERR_NOT_FOUND = -5;
export const ERR_NOT_ENOUGH_ENERGY = -6;
export const ERR_NOT_ENOUGH_RESOURCES = -7;
export const ERR_INVALID_TARGET = -8;
export const ERR_FULL = -9;
export const ERR_NOT_IN_RANGE = -10;
export const ERR_INVALID_ARGS = -11;
export const ERR_TIRED = -12;
export const ERR_NO_BODYPART = -13;
export const ERR_NOT_ENOUGH_EXTENSIONS = -14;
export const ERR_RCL_NOT_ENOUGH = -15;
export const ERR_GCL_NOT_ENOUGH = -16;

// Screeps 查找常量
export const FIND_MY_CREEPS = 101;
export const FIND_HOSTILE_CREEPS = 102;
export const FIND_SOURCES_ACTIVE = 104;
export const FIND_SOURCES = 105;
export const FIND_DROPPED_RESOURCES = 106;
export const FIND_STRUCTURES = 107;
export const FIND_CONSTRUCTION_SITES = 111;
export const FIND_MY_SPAWNS = 112;
export const FIND_HOSTILE_SPAWNS = 113;
export const FIND_MY_STRUCTURES = 114;
export const FIND_HOSTILE_STRUCTURES = 115;
export const FIND_FLAGS = 116;
export const FIND_EXIT = 117;
export const FIND_EXIT_TOP = 118;
export const FIND_EXIT_RIGHT = 119;
export const FIND_EXIT_BOTTOM = 120;
export const FIND_EXIT_LEFT = 121;

// Screeps 结构类型
export const STRUCTURE_SPAWN = 'spawn';
export const STRUCTURE_EXTENSION = 'extension';
export const STRUCTURE_ROAD = 'road';
export const STRUCTURE_WALL = 'constructedWall';
export const STRUCTURE_RAMPART = 'rampart';
export const STRUCTURE_KEEPER_LAIR = 'keeperLair';
export const STRUCTURE_PORTAL = 'portal';
export const STRUCTURE_CONTROLLER = 'controller';
export const STRUCTURE_LINK = 'link';
export const STRUCTURE_STORAGE = 'storage';
export const STRUCTURE_TOWER = 'tower';
export const STRUCTURE_OBSERVER = 'observer';
export const STRUCTURE_POWER_BANK = 'powerBank';
export const STRUCTURE_POWER_SPAWN = 'powerSpawn';
export const STRUCTURE_EXTRACTOR = 'extractor';
export const STRUCTURE_LAB = 'lab';
export const STRUCTURE_TERMINAL = 'terminal';
export const STRUCTURE_CONTAINER = 'container';
export const STRUCTURE_NUKER = 'nuker';

// Screeps 资源类型
export const RESOURCE_ENERGY = 'energy';
export const RESOURCE_POWER = 'power';

// Screeps 地形类型
export const TERRAIN_WALL = 'wall';
export const TERRAIN_SWAMP = 'swamp';
export const TERRAIN_PLAIN = 'plain';

export const Game: {
  creeps: { [name: string]: any };
  rooms: any;
  spawns: any;
  time: any;
  getObjectById?: (id: string) => any;
} = {
  creeps: {},
  rooms: [],
  spawns: {},
  time: 12345,
  getObjectById: (_id: string) => null
};

export const Memory: {
  creeps: { [name: string]: any };
  rooms?: { [roomName: string]: any };
} = {
  creeps: {}
};

// 创建一个带有正确内存结构的Creep
export function createMockCreep(name: string, role: string, room: string = 'W1N1'): any {
  return {
    name,
    memory: {
      role,
      room,
      working: false
    },
    pos: {
      x: 25,
      y: 25,
      roomName: room,
      getRangeTo: () => 5
    },
    room: {
      name: room,
      find: () => [],
      findExitTo: () => ERR_NO_PATH
    },
    say: () => {},
    moveTo: () => OK
  };
}

// 创建一个模拟的房间
export function createMockRoom(name: string): any {
  return {
    name,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
    find: () => [],
    lookForAt: () => [],
    createConstructionSite: () => OK
  };
}

// 创建一个模拟的Spawn
export function createMockSpawn(name: string, room: string): any {
  return {
    name,
    room: createMockRoom(room),
    spawnCreep: () => OK,
    spawning: null
  };
}

// 创建一个模拟的Source
export function createMockSource(id: string, room: string, x: number, y: number): any {
  return {
    id,
    pos: { x, y, roomName: room },
    energy: 3000,
    energyCapacity: 3000,
    ticksToRegeneration: 0
  };
}

// 创建一个模拟的Controller
export function createMockController(room: string, level: number = 1): any {
  return {
    room: createMockRoom(room),
    level,
    progress: 0,
    progressTotal: 0,
    upgradeBlocked: false
  };
}

// 设置全局常量（使用any类型避免类型冲突）
(global as any).WORK = WORK;
(global as any).CARRY = CARRY;
(global as any).MOVE = MOVE;
(global as any).ATTACK = ATTACK;
(global as any).RANGED_ATTACK = RANGED_ATTACK;
(global as any).HEAL = HEAL;
(global as any).CLAIM = CLAIM;
(global as any).TOUGH = TOUGH;
(global as any).OK = OK;
(global as any).ERR_NO_PATH = ERR_NO_PATH;
(global as any).ERR_NOT_IN_RANGE = ERR_NOT_IN_RANGE;
(global as any).ERR_INVALID_TARGET = ERR_INVALID_TARGET;
(global as any).ERR_BUSY = ERR_BUSY;
(global as any).ERR_NOT_FOUND = ERR_NOT_FOUND;
(global as any).ERR_NOT_ENOUGH_ENERGY = ERR_NOT_ENOUGH_ENERGY;
(global as any).ERR_FULL = ERR_FULL;
(global as any).ERR_INVALID_ARGS = ERR_INVALID_ARGS;

// 设置查找常量
(global as any).FIND_MY_CREEPS = FIND_MY_CREEPS;
(global as any).FIND_HOSTILE_CREEPS = FIND_HOSTILE_CREEPS;
(global as any).FIND_SOURCES = FIND_SOURCES;
(global as any).FIND_SOURCES_ACTIVE = FIND_SOURCES_ACTIVE;
(global as any).FIND_DROPPED_RESOURCES = FIND_DROPPED_RESOURCES;
(global as any).FIND_STRUCTURES = FIND_STRUCTURES;
(global as any).FIND_MY_STRUCTURES = FIND_MY_STRUCTURES;
(global as any).FIND_HOSTILE_STRUCTURES = FIND_HOSTILE_STRUCTURES;
(global as any).FIND_CONSTRUCTION_SITES = FIND_CONSTRUCTION_SITES;
(global as any).FIND_MY_SPAWNS = FIND_MY_SPAWNS;
(global as any).FIND_EXIT = FIND_EXIT;

// 设置结构类型常量
(global as any).STRUCTURE_SPAWN = STRUCTURE_SPAWN;
(global as any).STRUCTURE_EXTENSION = STRUCTURE_EXTENSION;
(global as any).STRUCTURE_ROAD = STRUCTURE_ROAD;
(global as any).STRUCTURE_WALL = STRUCTURE_WALL;
(global as any).STRUCTURE_STORAGE = STRUCTURE_STORAGE;
(global as any).STRUCTURE_CONTAINER = STRUCTURE_CONTAINER;
(global as any).STRUCTURE_TOWER = STRUCTURE_TOWER;
(global as any).STRUCTURE_LAB = STRUCTURE_LAB;
(global as any).STRUCTURE_TERMINAL = STRUCTURE_TERMINAL;

// 设置资源类型常量
(global as any).RESOURCE_ENERGY = RESOURCE_ENERGY;
(global as any).RESOURCE_POWER = RESOURCE_POWER;

// 设置地形类型常量
(global as any).TERRAIN_WALL = TERRAIN_WALL;
(global as any).TERRAIN_SWAMP = TERRAIN_SWAMP;
(global as any).TERRAIN_PLAIN = TERRAIN_PLAIN;
