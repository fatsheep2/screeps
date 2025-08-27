// 各角色需要的数量配置
export const ROLE_LIMITS = {
  staticHarvester: 0,  // 静态矿工（根据采矿点数量动态调整）
  upgrader: 5,         // 升级者
  builder: 2,          // 建造者
  carrier: 5           // 运输者（动态计算，这个值作为备用上限）
};

// 生产新 Creep 的身体部件配置（基础配置）
export const BASE_BODY_PARTS = {
  staticHarvester: [WORK, WORK, WORK], // 静态矿工：3个WORK部件
  upgrader: [WORK, CARRY, CARRY], // 静态升级工：1个WORK，2个CARRY，无MOVE部件
  builder: [WORK, CARRY, CARRY, MOVE, MOVE],  // 建筑工：1个WORK，2个CARRY，2个MOVE
  carrier: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE] // 运输兵：4个CARRY，2个MOVE
};

// 身体部件扩展配置（用于自动扩展）
export const BODY_EXTENSIONS = {
  staticHarvester: [WORK, WORK, WORK], // 每次扩展增加3个WORK
  upgrader: [WORK, CARRY, CARRY], // 每次扩展增加1个WORK，2个CARRY，保持2:1比例
  builder: [WORK, CARRY, CARRY, MOVE, MOVE],  // 每次扩展增加1个WORK，2个CARRY，2个MOVE
  carrier: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE] // 每次扩展增加4个CARRY，2个MOVE
};

// 身体部件能量消耗配置
export const BODY_PART_COSTS = {
  [WORK]: 100,
  [CARRY]: 50,
  [MOVE]: 50,
  [ATTACK]: 80,
  [RANGED_ATTACK]: 150,
  [HEAL]: 250,
  [CLAIM]: 600,
  [TOUGH]: 10
} as const;
