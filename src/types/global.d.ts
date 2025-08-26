// 扩展全局类型
declare global {
  interface Memory {
    uuid: number;
    log: any;
    rooms: { [roomName: string]: RoomMemory };
    combatSquads?: { [squadId: string]: CombatSquadMemory };
    attackTasks?: { [taskId: string]: AttackTaskMemory };
  }

  interface RoomMemory {
    staticHarvesters: number;
    upgraders: number;
    builders: number;
    carriers: number;
    miningSpots: string[]; // 记录可用的采矿点
    totalAvailableSpots: number; // 记录总可用空地数量
  }

  interface CreepMemory {
    role: string;
    room: string;
    working: boolean;
    sourceIndex?: number;  // 指定采集的资源点
    targetId?: string;     // 目标ID
    lastPos?: { x: number, y: number }; // 记录上一次位置，用于道路规划
    helpingStaticHarvester?: string; // 要帮助的静态矿工的名字
    lastExchangeTime?: number; // 记录最后一次交换完成的时间
    squadId?: string;      // 战斗小组ID
    patrolPoint?: { x: number, y: number }; // 巡逻点
    attackTarget?: string; // 攻击目标房间
    attackTaskId?: string; // 攻击任务ID
  }

  // 战斗小组内存结构
  interface CombatSquadMemory {
    id: string;
    members: {
      tank: string;      // 坦克
      warrior: string;   // 战士
      archer: string;    // 弓箭手
      healer: string;    // 牧师
    };
    status: 'forming' | 'ready' | 'engaged' | 'retreating';
    target?: string; // 目标敌人或位置
    formationTime: number;
    attackTaskId?: string; // 关联的攻击任务ID
    formationComplete?: boolean; // 列队是否完成
    formationCenter?: { x: number; y: number }; // 列队中心位置
    moveTarget?: { x: number; y: number }; // 编组移动目标
    lastMoveTime?: number; // 最后移动时间
  }

  // 攻击任务内存结构
  interface AttackTaskMemory {
    id: string;
    targetRoom: string;
    sourceRoom: string;
    squads: string[]; // 参与攻击的战斗小组ID
    status: 'planning' | 'moving' | 'engaging' | 'retreating' | 'completed' | 'failed';
    priority: 'low' | 'medium' | 'high' | 'critical';
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    targetType: 'room' | 'structure' | 'creep';
    targetId?: string; // 特定目标ID
    estimatedEnergy: number; // 预估所需能量
    currentEnergy: number; // 当前可用能量
  }
}

export {};
