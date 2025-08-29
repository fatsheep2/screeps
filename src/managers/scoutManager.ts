// 智能侦察兵管理系统
// 只在真正需要时生成侦察兵，避免无限生产

export class ScoutManager {
  // 检查房间是否需要侦察兵
  public static shouldProduceScout(room: Room): boolean {
    const rcl = room.controller?.level || 1;
    
    // RCL4以下或能量不足时不生产侦察兵
    if (rcl < 4 || room.energyCapacityAvailable < 1300) {
      return false;
    }
    
    // 检查是否已有活跃的侦察兵
    const activeScouts = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'scout'
    });
    
    // 如果已有侦察兵，不生产更多
    if (activeScouts.length > 0) {
      return false;
    }
    
    // 检查是否有未探索的相邻房间
    const unexploredRooms = this.findUnexploredAdjacentRooms(room);
    
    // 只有在有未探索房间时才生产侦察兵
    return unexploredRooms.length > 0;
  }
  
  // 寻找未探索的相邻房间
  public static findUnexploredAdjacentRooms(room: Room): string[] {
    const unexplored: string[] = [];
    
    // 获取所有相邻房间（使用Game.map.describeExits）
    const exits = Game.map.describeExits(room.name);
    if (!exits) return unexplored;
    
    const directions = [TOP, RIGHT, BOTTOM, LEFT] as const;
    
    for (const direction of directions) {
      const adjacentRoomName = exits[direction];
      if (!adjacentRoomName) continue;
      
      // 检查是否有实际的出口连接（使用findExitTo验证）
      const exitDirection = room.findExitTo(adjacentRoomName);
      if (exitDirection === ERR_NO_PATH || exitDirection === ERR_INVALID_ARGS) {
        // 无法到达这个房间，跳过
        continue;
      }
      
      // 检查内存中是否有完整的房间数据
      if (!this.isRoomDataComplete(adjacentRoomName)) {
        unexplored.push(adjacentRoomName);
      }
    }
    
    return unexplored;
  }
  
  // 检查房间数据是否完整（包含地形、矿点等基本信息）
  private static isRoomDataComplete(roomName: string): boolean {
    const roomMemory = Memory.rooms[roomName];
    
    // 如果没有房间内存，说明未探索
    if (!roomMemory) {
      return false;
    }
    
    // 检查是否有基本的地形信息标记
    if (!(roomMemory as any).scoutedAt) {
      return false;
    }
    
    // 检查是否有矿点信息（即使是空数组也算完整）
    if (!(roomMemory as any).sources && (roomMemory as any).sources !== null) {
      return false;
    }
    
    // 检查是否有控制器信息
    if ((roomMemory as any).controller === undefined) {
      return false;
    }
    
    return true;
  }
  
  // 分配侦察任务给现有的侦察兵
  public static assignScoutTasks(room: Room): void {
    const scouts = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'scout'
    });
    
    const unexploredRooms = this.findUnexploredAdjacentRooms(room);
    
    for (const scout of scouts) {
      // 如果侦察兵没有目标房间或目标房间已探索完成
      if (!(scout.memory as any).targetRoom || 
          !unexploredRooms.includes((scout.memory as any).targetRoom)) {
        
        if (unexploredRooms.length > 0) {
          // 分配新的未探索房间
          (scout.memory as any).targetRoom = unexploredRooms[0];
          unexploredRooms.shift(); // 移除已分配的房间
          console.log(`[侦察管理] ${scout.name} 分配新目标: ${(scout.memory as any).targetRoom}`);
        } else {
          // 没有更多房间需要探索，侦察兵可以自毁或转换角色
          (scout.memory as any).targetRoom = null;
          console.log(`[侦察管理] ${scout.name} 探索完成，等待新任务`);
        }
      }
    }
  }
  
  // 记录房间探索完成
  public static markRoomExplored(roomName: string, roomData: any): void {
    if (!Memory.rooms[roomName]) {
      Memory.rooms[roomName] = {
        staticHarvesters: 0,
        upgraders: 0,
        builders: 0,
        carriers: 0,
        miningSpots: [],
        totalAvailableSpots: 0,
        tasks: {}
      };
    }
    
    const roomMemory = Memory.rooms[roomName];
    
    // 记录探索时间
    (roomMemory as any).scoutedAt = Game.time;
    
    // 记录矿点信息
    (roomMemory as any).sources = roomData.sources || null;
    
    // 记录控制器信息
    (roomMemory as any).controller = roomData.controller || null;
    
    // 记录其他有用信息
    if (roomData.mineral) {
      (roomMemory as any).mineral = roomData.mineral;
    }
    
    if (roomData.hostileStructures) {
      (roomMemory as any).hostileStructures = roomData.hostileStructures;
    }
    
    console.log(`[侦察管理] 房间 ${roomName} 探索完成，数据已保存`);
  }
  
  // 获取房间探索状态报告
  public static getExplorationReport(room: Room): string {
    const unexplored = this.findUnexploredAdjacentRooms(room);
    const activeScouts = room.find(FIND_MY_CREEPS, {
      filter: c => (c.memory as any).role === 'scout'
    });
    
    let report = `房间 ${room.name} 探索状态:\\n`;
    report += `- 活跃侦察兵: ${activeScouts.length}\\n`;
    report += `- 未探索相邻房间: ${unexplored.length} 个 [${unexplored.join(', ')}]\\n`;
    
    for (const scout of activeScouts) {
      const target = (scout.memory as any).targetRoom || '无目标';
      report += `- ${scout.name}: 目标 ${target}\\n`;
    }
    
    return report;
  }
}