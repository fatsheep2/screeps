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
  }
}

export {};
