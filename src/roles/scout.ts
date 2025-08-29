export class RoleScout {
  public static run(creep: Creep): void {
    // 检查是否有侦察任务
    if (!creep.memory.targetRoom) {
      this.assignScoutTask(creep);
      return;
    }

    const targetRoom = creep.memory.targetRoom;
    const taskType = creep.memory.taskType || 'scout';

    // 如果不在目标房间，前往目标房间
    if (creep.room.name !== targetRoom) {
      this.moveToTargetRoom(creep, targetRoom);
      return;
    }

    // 在目标房间，执行对应任务
    switch (taskType) {
      case 'scout':
        this.performScoutTask(creep);
        break;
      case 'reserve':
        this.performReserveTask(creep);
        break;
      default:
        console.log(`[侦察兵${creep.name}] 未知任务类型: ${taskType}`);
        this.assignScoutTask(creep);
    }
  }

  // 分配侦察任务
  private static assignScoutTask(creep: Creep): void {
    const homeRoom = Game.rooms[creep.memory.homeRoom || creep.room.name];
    if (!homeRoom) return;

    // 从房间内存获取待侦察的房间
    const roomMemory = Memory.rooms[homeRoom.name];
    if (!roomMemory.scoutTargets) {
      this.generateScoutTargets(homeRoom);
    }

    // 寻找未侦察的房间
    const unscoutedRooms = roomMemory.scoutTargets?.filter(room =>
      !roomMemory.scoutedRooms?.[room]
    ) || [];

    if (unscoutedRooms.length > 0) {
      const targetRoom = unscoutedRooms[0];
      creep.memory.targetRoom = targetRoom;
      creep.memory.taskType = 'scout';
      creep.say('🔍 侦察');
      console.log(`[侦察兵${creep.name}] 分配侦察任务: ${targetRoom}`);
    } else {
      // 检查是否有需要预定的房间
      this.assignReserveTask(creep);
    }
  }

  // 分配预定任务
  private static assignReserveTask(creep: Creep): void {
    const homeRoom = Game.rooms[creep.memory.homeRoom || creep.room.name];
    if (!homeRoom) return;

    const roomMemory = Memory.rooms[homeRoom.name];
    const suitableRooms = roomMemory.remoteMiningTargets || [];

    // 寻找需要预定的房间
    for (const roomName of suitableRooms) {
      const roomData = roomMemory.scoutedRooms?.[roomName];
      if (roomData && !roomData.reserved) {
        creep.memory.targetRoom = roomName;
        creep.memory.taskType = 'reserve';
        creep.say('🏴 预定');
        console.log(`[侦察兵${creep.name}] 分配预定任务: ${roomName}`);
        return;
      }
    }

    // 没有任务，待机
    creep.say('⏸️ 待机');
  }

  // 生成侦察目标（周边四个房间）
  private static generateScoutTargets(homeRoom: Room): void {
    const roomMemory = Memory.rooms[homeRoom.name];
    if (!roomMemory.scoutTargets) {
      roomMemory.scoutTargets = [];
    }

    // 解析房间坐标
    const match = homeRoom.name.match(/^([WE])(\d+)([NS])(\d+)$/);
    if (!match) return;

    const [, ewDir, ewNum, nsDir, nsNum] = match;
    const x = ewDir === 'W' ? -parseInt(ewNum) : parseInt(ewNum);
    const y = nsDir === 'N' ? -parseInt(nsNum) : parseInt(nsNum);

    // 生成四个方向的相邻房间
    const directions = [
      { dx: 1, dy: 0 },   // 东
      { dx: -1, dy: 0 },  // 西
      { dx: 0, dy: 1 },   // 南
      { dx: 0, dy: -1 }   // 北
    ];

    for (const dir of directions) {
      const newX = x + dir.dx;
      const newY = y + dir.dy;

      const newEwDir = newX < 0 ? 'W' : 'E';
      const newNsDir = newY < 0 ? 'N' : 'S';
      const roomName = `${newEwDir}${Math.abs(newX)}${newNsDir}${Math.abs(newY)}`;

      if (!roomMemory.scoutTargets.includes(roomName)) {
        roomMemory.scoutTargets.push(roomName);
      }
    }

    console.log(`[侦察兵] 为房间${homeRoom.name}生成侦察目标: ${roomMemory.scoutTargets.join(', ')}`);
  }

  // 移动到目标房间
  private static moveToTargetRoom(creep: Creep, targetRoom: string): void {
    // 检查是否在目标房间
    if (creep.room.name === targetRoom) {
      console.log(`[侦察兵${creep.name}] 🎉 已到达目标房间 ${targetRoom}！`);
      creep.say('🎯 已到达');

      // 进入房间后，先移动到房间中心附近，然后开始侦察
      if (creep.pos.getRangeTo(25, 25) > 5) {
        creep.moveTo(new RoomPosition(25, 25, targetRoom), {
          visualizePathStyle: { stroke: '#00ff00' }
        });
        creep.say('🔍 去侦察');
      }
      return;
    }

    // 使用简化的跨房间移动逻辑（参考tank）
    creep.moveTo(new RoomPosition(25, 25, targetRoom), {
      reusePath: 10,
      range: 10,
      visualizePathStyle: { stroke: '#00ff00' }, // 绿色路径，区分tank的红色
    });
    creep.say(`➡️ ${targetRoom}`);
  }

    // 执行侦察任务
  private static performScoutTask(creep: Creep): void {
    const room = creep.room;
    const roomName = room.name;
    const homeRoom = Game.rooms[creep.memory.homeRoom || 'unknown'];

    if (!homeRoom) return;

    // 检查是否真的在目标房间（防止边界误判）
    if (roomName !== creep.memory.targetRoom) {
      console.log(`[侦察兵${creep.name}] 仍在前往目标房间${creep.memory.targetRoom}的路上，当前在${roomName}`);
      return;
    }

    console.log(`[侦察兵${creep.name}] 开始侦察房间${roomName}`);

    // 收集房间信息
    const roomData: any = {
      scoutedAt: Game.time,
      sources: [],
      minerals: [],
      controller: null,
      hostile: false,
      reserved: false
    };

    // 扫描能源矿
    const sources = room.find(FIND_SOURCES);
    for (const source of sources) {
      roomData.sources.push({
        id: source.id,
        pos: { x: source.pos.x, y: source.pos.y },
        energyCapacity: source.energyCapacity
      });
    }

    // 扫描矿物
    const minerals = room.find(FIND_MINERALS);
    for (const mineral of minerals) {
      roomData.minerals.push({
        id: mineral.id,
        mineralType: mineral.mineralType,
        pos: { x: mineral.pos.x, y: mineral.pos.y }
      });
    }

    // 扫描控制器
    if (room.controller) {
      roomData.controller = {
        id: room.controller.id,
        pos: { x: room.controller.pos.x, y: room.controller.pos.y },
        owner: room.controller.owner?.username || null,
        reservation: room.controller.reservation ? {
          username: room.controller.reservation.username,
          ticksToEnd: room.controller.reservation.ticksToEnd
        } : null,
        level: room.controller.level || 0
      };

      // 检查是否有敌对玩家
      if (room.controller.owner && room.controller.owner.username !== homeRoom.controller?.owner?.username) {
        roomData.hostile = true;
      }

      // 检查预定状态
      if (room.controller.reservation) {
        roomData.reserved = true;
      }
    }

    // 保存信息到房间内存
    const homeRoomMemory = Memory.rooms[homeRoom.name];
    if (!homeRoomMemory.scoutedRooms) {
      homeRoomMemory.scoutedRooms = {};
    }
    homeRoomMemory.scoutedRooms[roomName] = roomData;

    console.log(`[侦察兵${creep.name}] 完成房间${roomName}侦察: ${sources.length}个能源矿, ${minerals.length}个矿物, 控制器等级${roomData.controller?.level || 0}`);

    // 评估是否适合外矿
    this.evaluateRemoteMining(homeRoom, roomName, roomData);

    // 任务完成，获取新任务
    delete creep.memory.targetRoom;
    delete creep.memory.taskType;
    this.assignScoutTask(creep);
  }

  // 执行预定任务
  private static performReserveTask(creep: Creep): void {
    const room = creep.room;
    const controller = room.controller;

    // 检查是否在正确的目标房间
    if (room.name !== creep.memory.targetRoom) {
      console.log(`[侦察兵${creep.name}] 仍在前往目标房间${creep.memory.targetRoom}的路上，当前在${room.name}`);
      return;
    }

    if (!controller) {
      console.log(`[侦察兵${creep.name}] 房间${room.name}没有控制器`);
      delete creep.memory.targetRoom;
      delete creep.memory.taskType;
      return;
    }

    const reserveResult = creep.reserveController(controller);

    if (reserveResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller);
      creep.say('🚶 去预定');
    } else if (reserveResult === OK) {
      creep.say('🏴 预定成功');
      console.log(`[侦察兵${creep.name}] 成功预定房间${room.name}`);

      // 更新房间数据
      const homeRoom = Game.rooms[creep.memory.homeRoom || 'unknown'];
      if (homeRoom) {
        const homeRoomMemory = Memory.rooms[homeRoom.name];
        if (homeRoomMemory.scoutedRooms?.[room.name]) {
          homeRoomMemory.scoutedRooms[room.name].reserved = true;
        }
      }

      // 任务完成
      delete creep.memory.targetRoom;
      delete creep.memory.taskType;
    } else {
      console.log(`[侦察兵${creep.name}] 预定失败: ${reserveResult}`);
      creep.say('❌ 预定失败');
    }
  }

  // 评估外矿适合性
  private static evaluateRemoteMining(homeRoom: Room, targetRoomName: string, roomData: any): void {
    // 跳过有敌对玩家的房间
    if (roomData.hostile) {
      console.log(`[外矿评估] 房间${targetRoomName}有敌对玩家，跳过`);
      return;
    }

    // 跳过没有能源矿的房间
    if (roomData.sources.length === 0) {
      console.log(`[外矿评估] 房间${targetRoomName}没有能源矿，跳过`);
      return;
    }

    // 计算到家房间的距离（简单估算）
    const homePos = homeRoom.controller?.pos || homeRoom.find(FIND_MY_SPAWNS)[0]?.pos;
    if (!homePos) return;

    let totalScore = 0;
    let sourceCount = roomData.sources.length;

    // 评估每个能源矿
    for (const source of roomData.sources) {
      // 距离评分（距离越近得分越高）
      const distance = Game.map.getRoomLinearDistance(homeRoom.name, targetRoomName);
      const distanceScore = Math.max(0, 10 - distance); // 最远10个房间

      // 能源容量评分
      const capacityScore = source.energyCapacity / 3000 * 5; // 标准矿3000容量得5分

      const sourceScore = distanceScore + capacityScore;
      totalScore += sourceScore;
    }

    // 多矿加成
    if (sourceCount > 1) {
      totalScore *= 1.2;
    }

    console.log(`[外矿评估] 房间${targetRoomName}: ${sourceCount}个矿, 距离${Game.map.getRoomLinearDistance(homeRoom.name, targetRoomName)}, 总分${totalScore.toFixed(1)}`);

    // 评分大于6分认为适合开发
    if (totalScore >= 6) {
      const homeRoomMemory = Memory.rooms[homeRoom.name];
      if (!homeRoomMemory.remoteMiningTargets) {
        homeRoomMemory.remoteMiningTargets = [];
      }

      if (!homeRoomMemory.remoteMiningTargets.includes(targetRoomName)) {
        homeRoomMemory.remoteMiningTargets.push(targetRoomName);
        console.log(`[外矿评估] 房间${targetRoomName}适合开发外矿，已添加到目标列表`);
      }
    }
  }
}
