// 战斗兵种配置
export const COMBAT_ROLES = {
  WARRIOR: 'warrior',      // 近战战士
  TANK: 'tank',           // 坦克
  HEALER: 'healer',       // 牧师/治疗者
  ARCHER: 'archer'        // 弓箭手
} as const;

// 战斗兵种的身体部件基础配置
export const COMBAT_BODY_PARTS = {
  [COMBAT_ROLES.WARRIOR]: {
    base: [TOUGH, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK], // 1:3:3 配比
    cost: 400, // TOUGH(10) + 3*MOVE(150) + 3*ATTACK(240) = 400
    ratios: { TOUGH: 1, MOVE: 3, ATTACK: 3 }
  },
  [COMBAT_ROLES.TANK]: {
    base: [TOUGH, TOUGH, MOVE], // 1:2 配比
    cost: 110, // TOUGH(10) + 2*MOVE(100) = 110
    ratios: { TOUGH: 2, MOVE: 1 }
  },
  [COMBAT_ROLES.HEALER]: {
    base: [MOVE, HEAL, HEAL], // 1:2 配比
    cost: 550, // MOVE(50) + 2*HEAL(500) = 550
    ratios: { MOVE: 1, HEAL: 2 }
  },
  [COMBAT_ROLES.ARCHER]: {
    base: [MOVE, RANGED_ATTACK, RANGED_ATTACK], // 1:2 配比
    cost: 350, // MOVE(50) + 2*RANGED_ATTACK(300) = 350
    ratios: { MOVE: 1, RANGED_ATTACK: 2 }
  }
} as const;

// 战斗小组配置
export const COMBAT_SQUAD_SIZE = 4; // 一个战斗小组4个兵种

// 战斗小组角色分配
export const SQUAD_ROLES = [
  COMBAT_ROLES.TANK,      // 坦克 - 前排抗伤害
  COMBAT_ROLES.WARRIOR,   // 战士 - 近战输出
  COMBAT_ROLES.ARCHER,    // 弓箭手 - 远程输出
  COMBAT_ROLES.HEALER     // 牧师 - 治疗支援
] as const;

// 身体部件能量消耗
export const BODY_PART_COSTS = {
  [TOUGH]: 10,
  [MOVE]: 50,
  [ATTACK]: 80,
  [RANGED_ATTACK]: 150,
  [HEAL]: 250
} as const;

// 攻击评估配置
export const ATTACK_ASSESSMENT_CONFIG = {
  // 威胁等级阈值
  THREAT_THRESHOLDS: {
    EXTREME: { hostiles: 5, structures: 20 },
    HIGH: { hostiles: 3, structures: 15 },
    MEDIUM: { hostiles: 1, structures: 10 }
  },

  // 战斗小组计算参数
  SQUAD_CALCULATION: {
    HOSTILE_WEIGHT: 1,        // 每个敌对Creep的权重
    STRUCTURE_WEIGHT: 0.2,    // 每个敌对建筑的权重 (1/5)
    DIVISOR: 2,               // 总威胁点数除以这个数
    MAX_SQUADS: 4             // 最大战斗小组数量
  },

  // 能量消耗估算
  ENERGY_ESTIMATION: {
    HOSTILE_COST: 200,        // 每个敌对Creep预估消耗
    STRUCTURE_COST: 100       // 每个敌对建筑预估消耗
  },

  // 成功概率
  SUCCESS_PROBABILITY: {
    LOW: 0.8,
    MEDIUM: 0.7,
    HIGH: 0.5,
    EXTREME: 0.3
  }
} as const;
