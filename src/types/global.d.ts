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
    tasks?: { [taskId: string]: any }; // 任务系统
  }

  interface CreepMemory {
    role: string;
    room: string;
    working: boolean;
    sourceIndex?: number;  // 指定采集的资源点
    targetId?: string;     // 目标ID
    lastPos?: { x: number, y: number, tick: number }; // 记录上一次位置和时间，用于检测卡住
    helpingStaticHarvester?: string; // 要帮助的静态矿工的名字
    lastExchangeTime?: number; // 记录最后一次交换完成的时间
    squadId?: string;      // 战斗小组ID
    patrolPoint?: { x: number, y: number }; // 巡逻点
    attackTarget?: string; // 攻击目标房间
    attackTaskId?: string; // 攻击任务ID
    isLeader?: boolean;    // 是否为队长
    currentTaskId?: string; // 当前执行的任务ID
    testMoveToRoom?: string; // 测试用：目标房间名称
    stuckCounter?: number; // 卡住计数器，用于检测是否在同一个位置徘徊
    // 跨房间移动测试相关字段
    testStartTime?: number;
    testStartRoom?: string;
    testStartPos?: { x: number, y: number };
    moveTrace?: string[];
    integrationTest?: {
      scenario: string;
      startTime: number;
      startRoom: string;
      targetRoom: string;
      expectedDuration: number;
    };
    // 任务批处理相关
    currentTaskBatch?: string[]; // 当前执行的批处理任务ID列表
    currentTaskIndex?: number;   // 当前执行的批处理任务索引
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
    isAssembling?: boolean; // 是否正在集合
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
