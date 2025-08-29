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

    // 分配侦察任务 - 侦察兵只执行任务，不创建任务
  private static assignScoutTask(creep: Creep): void {
    // 必须使用homeRoom，不能使用creep.room.name，因为侦察兵可能在其他房间
    if (!creep.memory.homeRoom) {
      console.log(`[侦察兵${creep.name}] 没有设置归属房间`);
      return;
    }

    const homeRoom = Game.rooms[creep.memory.homeRoom];
    if (!homeRoom) {
      console.log(`[侦察兵${creep.name}] 无法找到归属房间: ${creep.memory.homeRoom}`);
      return;
    }

    const roomMemory = Memory.rooms[homeRoom.name];
    if (!roomMemory.tasks) return;

    // 寻找可执行的侦察任务
    const availableScoutTask = Object.values(roomMemory.tasks).find((task: any) =>
      task.type === 'scoutRoom' &&
      task.status === 'pending' &&
      !task.assignedTo
    );

    if (availableScoutTask) {
      // 分配任务给自己
      creep.memory.targetRoom = availableScoutTask.targetRoom;
      creep.memory.taskType = 'scout';
      creep.memory.currentTaskId = availableScoutTask.id;

      // 更新任务状态
      availableScoutTask.assignedTo = creep.id;
      availableScoutTask.assignedAt = Game.time;
      availableScoutTask.status = 'assigned';
      roomMemory.tasks[availableScoutTask.id] = availableScoutTask;

      creep.say('🔍 侦察');
      console.log(`[侦察兵${creep.name}] 接受侦察任务: ${availableScoutTask.id} - ${availableScoutTask.targetRoom}`);
    } else {
      // 没有可执行的侦察任务，检查预定任务
      this.assignReserveTask(creep);
    }
  }

  // 分配预定任务 - 侦察兵只执行任务，不创建任务
  private static assignReserveTask(creep: Creep): void {
    // 必须使用homeRoom，不能使用creep.room.name，因为侦察兵可能在其他房间
    if (!creep.memory.homeRoom) {
      console.log(`[侦察兵${creep.name}] 没有设置归属房间`);
      return;
    }

    const homeRoom = Game.rooms[creep.memory.homeRoom];
    if (!homeRoom) {
      console.log(`[侦察兵${creep.name}] 无法找到归属房间: ${creep.memory.homeRoom}`);
      return;
    }

    const roomMemory = Memory.rooms[homeRoom.name];
    if (!roomMemory.tasks) return;

    // 寻找可执行的预定任务
    const availableReserveTask = Object.values(roomMemory.tasks).find((task: any) =>
      task.type === 'reserveRoom' &&
      task.status === 'pending' &&
      !task.assignedTo
    );

    if (availableReserveTask) {
      // 分配任务给自己
      creep.memory.targetRoom = availableReserveTask.targetRoom;
      creep.memory.taskType = 'reserve';
      creep.memory.currentTaskId = availableReserveTask.id;

      // 更新任务状态
      availableReserveTask.assignedTo = creep.id;
      availableReserveTask.assignedAt = Game.time;
      availableReserveTask.status = 'assigned';
      roomMemory.tasks[availableReserveTask.id] = availableReserveTask;

      creep.say('🏴 预定');
      console.log(`[侦察兵${creep.name}] 接受预定任务: ${availableReserveTask.id} - ${availableReserveTask.targetRoom}`);
    } else {
      // 没有可执行的任务，待机
      creep.say('💤 待机');
      console.log(`[侦察兵${creep.name}] 没有可执行的任务，待机中`);
    }
  }

      // 生成侦察目标（只检查直接相邻且有直接出入口的房间） - 暂时注释掉，由房间管理器统一管理
  // private static generateScoutTargets(homeRoom: Room): void {
  //   const roomMemory = Memory.rooms[homeRoom.name];
  //   if (!roomMemory.scoutTargets) {
  //     roomMemory.scoutTargets = [];
  //   }

  //   // 清空现有目标，重新生成
  //   roomMemory.scoutTargets = [];

  //   // 解析房间坐标
  //   const match = homeRoom.name.match(/^([WE])(\d+)([NS])(\d+)$/);
  //   if (!match) return;

  //   const [, ewDir, ewNum, nsDir, nsNum] = match;
  //   const x = ewDir === 'W' ? -parseInt(ewNum) : parseInt(ewNum);
  //   const y = nsDir === 'N' ? -parseInt(nsNum) : parseInt(nsNum);

  //   // 生成四个方向的相邻房间
  //   const directions = [
  //     const newX = x + dir.dx;
  //     const newY = y + dir.dy;

  //     const newEwDir = newX < 0 ? 'W' : 'E';
  //     const newNsDir = newY < 0 ? 'N' : 'S';
  //     const roomName = `${newEwDir}${Math.abs(newX)}${newNsDir}${Math.abs(newY)}`;

  //     // 检查是否有直接出入口（避免需要绕路的房间）
  //     const exitDir = homeRoom.findExitTo(roomName);
  //     if (exitDir !== ERR_NO_PATH && exitDir !== ERR_INVALID_ARGS) {
  //       roomMemory.scoutTargets.push(roomName);
  //       console.log(`[侦察兵] 房间${roomName}与${homeRoom.name}有直接出入口，添加到侦察目标`);
  //     } else {
  //       console.log(`[侦察兵] 房间${roomName}与${homeRoom.name}无直接出入口，跳过`);
  //     }
  //   }

  //   console.log(`[侦察兵] 为房间${homeRoom.name}生成直接相邻侦察目标: ${roomMemory.scoutTargets.join(', ')}`);
  // }

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
      reserved: false,
      terrain: {} // 添加地形数据
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

    // 收集房间地形数据（用于路径计算）
    const terrain = Game.map.getRoomTerrain(roomName);
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const terrainType = terrain.get(x, y);
        if (terrainType & TERRAIN_MASK_WALL) {
          if (!roomData.terrain.walls) roomData.terrain.walls = [];
          roomData.terrain.walls.push({ x, y });
        }
      }
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

    // 评估房间适合性并输出评分
    this.evaluateRoomSuitability(homeRoom, roomName, roomData);

    // 评估是否适合外矿 - 暂时注释掉
    // this.evaluateRemoteMining(homeRoom, roomName, roomData);

    // 更新任务状态为完成
    if (creep.memory.currentTaskId) {
      const homeRoomMemory = Memory.rooms[homeRoom.name];
      if (homeRoomMemory.tasks?.[creep.memory.currentTaskId]) {
        homeRoomMemory.tasks[creep.memory.currentTaskId].status = 'completed';
        console.log(`[侦察兵${creep.name}] 侦察任务完成: ${creep.memory.currentTaskId}`);
      }
    }

    // 任务完成，清理内存
    delete creep.memory.targetRoom;
    delete creep.memory.taskType;
    delete creep.memory.currentTaskId;

    // 检查是否还有未侦察的房间
    const remainingUnscoutedRooms = homeRoomMemory.scoutTargets?.filter((room: string) => {
      const roomData = homeRoomMemory.scoutedRooms?.[room];
      return !roomData ||
             !roomData.sources ||
             !roomData.controller ||
             !roomData.terrain ||
             !roomData.mineral;
    }) || [];

    if (remainingUnscoutedRooms.length > 0) {
      // 还有未侦察的房间，获取新任务
      this.assignScoutTask(creep);
    } else {
      // 所有房间都已侦察完成，待机
      creep.say('💤 侦察完成');
      console.log(`[侦察兵${creep.name}] 所有房间都已侦察完成，待机中`);
    }
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

    // 检查是否已经预定
    if (controller.reservation && controller.reservation.username === creep.memory.homeRoom) {
      creep.say('🏴 已预定');
      console.log(`[侦察兵${creep.name}] 房间${room.name}已经被我们预定`);

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
      return;
    }

    const reserveResult = creep.reserveController(controller);

    if (reserveResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, {
        visualizePathStyle: { stroke: '#ffaa00' },
        range: 1
      });
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

      // 预定失败，可能是权限问题，删除任务
      delete creep.memory.targetRoom;
      delete creep.memory.taskType;
    }
  }

    // 评估外矿适合性 - 暂时注释掉
  // private static evaluateRemoteMining(homeRoom: Room, targetRoomName: string, roomData: any): void {
  //   // 跳过有敌对玩家的房间
  //   if (roomData.hostile) {
  //     console.log(`[外矿评估] 房间${targetRoomName}有敌对玩家，跳过`);
  //     return;
  //   }

  //   // 跳过没有能源矿的房间
  //   if (roomData.sources.length === 0) {
  //     console.log(`[外矿评估] 房间${targetRoomName}没有能源矿，跳过`);
  //     return;
  //   }

  //   // 计算到家房间的距离
  //   const roomDistance = Game.map.getRoomLinearDistance(homeRoom.name, targetRoomName);

  //   // 距离太远的房间不适合开发（超过3个房间）
  //   if (roomDistance > 3) {
  //     console.log(`[外矿评估] 房间${targetRoomName}距离太远(${roomDistance}个房间)，跳过`);
  //     return;
  //   }

  //   // 获取主城位置用于精确距离计算
  //   const homeSpawn = homeRoom.find(FIND_MY_SPAWNS)[0];
  //   if (!homeSpawn) {
  //     console.log(`[外矿评估] 无法找到主城位置，跳过评估`);
  //     return;
  //   }

  //   let totalScore = 0;
  //   let sourceCount = roomData.sources.length;

  //   // 评估每个能源矿
  //   for (const source of roomData.sources) {
  //     // 计算矿点到主城的实际距离（考虑房间边界）
  //     const sourcePos = new RoomPosition(source.pos.x, source.pos.y, targetRoomName);
  //     const distanceToHome = this.calculateDistanceToHome(homeSpawn.pos, sourcePos, roomDistance);

  //   //   // 距离评分（距离越近得分越高，最大10分）
  //   //   const distanceScore = Math.max(0, 10 - Math.floor(distanceToHome / 10));

  //   //   // 矿点位置评分（靠近房间出口的矿点得分更高）
  //   //   const exitProximityScore = this.calculateExitProximityScore(sourcePos, targetRoomName, homeRoom.name);

  //   //   const sourceScore = distanceScore + exitProximityScore;
  //   //   totalScore += sourceScore;
  //   // }

  //   // 控制器距离评分
  //   if (roomData.controller) {
  //     const roomData.controller.pos.x, roomData.controller.pos.y, targetRoomName);
  //     const controllerDistance = this.calculateDistanceToHome(homeSpawn.pos, controllerPos, roomDistance);
  //     const controllerScore = Math.max(0, 5 - Math.floor(controllerDistance / 5));
  //     totalScore += controllerScore;
  //   }

  //   // 多矿加成
  //   if (sourceCount > 1) {
  //     totalScore *= 1.2;
  //   }

  //   // 距离惩罚（房间距离越远，分数越低）
  //   const distancePenalty = roomDistance * 2;
  //   totalScore = Math.max(0, totalScore - distancePenalty);

  //   console.log(`[外矿评估] 房间${targetRoomName}: ${sourceCount}个矿, 房间距离${roomDistance}, 总分${totalScore.toFixed(1)}`);

  //   // 评分大于8分认为适合开发
  //   if (totalScore >= 8) {
  //     const homeRoomMemory = Memory.rooms[homeRoom.name];
  //     if (!homeRoomMemory.remoteMiningTargets) {
  //       homeRoomMemory.remoteMiningTargets = [];
  //       homeRoomMemory.remoteMiningTargets.push(targetRoomName);
  //       console.log(`[外矿评估] 房间${targetRoomName}适合开发外矿，已添加到目标列表`);
  //     }
  //   }
  // }

  // 评估房间适合性并输出评分
  private static evaluateRoomSuitability(homeRoom: Room, targetRoomName: string, roomData: any): void {
    console.log(`\n[房间评分] ====== 房间 ${targetRoomName} 适合性评估 ======`);

    // 跳过有敌对玩家的房间
    if (roomData.hostile) {
      console.log(`[房间评分] ❌ 敌对房间: 房间${targetRoomName}有敌对玩家，不适合开发`);
      return;
    }

    // 跳过没有能源矿的房间
    if (roomData.sources.length === 0) {
      console.log(`[房间评分] ❌ 无能源: 房间${targetRoomName}没有能源矿，不适合开发`);
      return;
    }

    // 计算到家房间的距离
    const roomDistance = Game.map.getRoomLinearDistance(homeRoom.name, targetRoomName);
    console.log(`[房间评分] 📏 房间距离: ${roomDistance} 个房间`);

    // 距离太远的房间不适合开发（超过3个房间）
    if (roomDistance > 3) {
      console.log(`[房间评分] ❌ 距离过远: 房间${targetRoomName}距离太远(${roomDistance}个房间)，不适合开发`);
      return;
    }

    // 获取主城位置用于精确距离计算
    const homeSpawn = homeRoom.find(FIND_MY_SPAWNS)[0];
    if (!homeSpawn) {
      console.log(`[房间评分] ❌ 无法找到主城位置，跳过评估`);
      return;
    }

    let totalScore = 0;
    const sourceCount = roomData.sources.length;
    console.log(`[房间评分] ⚡ 能源矿数量: ${sourceCount} 个`);

    // 评估每个能源矿
    console.log(`[房间评分] 🔍 详细矿点评估:`);
    for (let i = 0; i < roomData.sources.length; i++) {
      const source = roomData.sources[i];
      const sourcePos = new RoomPosition(source.pos.x, source.pos.y, targetRoomName);

      // 计算矿点到主城的实际距离
      const distanceToHome = this.calculateDistanceToHome(homeSpawn.pos, sourcePos, roomDistance);

      // 距离评分（距离越近得分越高，最大10分）
      const distanceScore = Math.max(0, 10 - Math.floor(distanceToHome / 10));

      // 矿点位置评分（靠近房间出口的矿点得分更高）
      const exitProximityScore = this.calculateExitProximityScore(sourcePos, targetRoomName, homeRoom.name);

      const sourceScore = distanceScore + exitProximityScore;
      totalScore += sourceScore;

      console.log(`  [房间评分]   矿点${i + 1}: 位置(${source.pos.x},${source.pos.y}), 距离主城${distanceToHome.toFixed(1)}格, 距离得分${distanceScore}, 出口接近得分${exitProximityScore}, 总分${sourceScore}`);
    }

    // 控制器距离评分
    if (roomData.controller) {
      const controllerPos = new RoomPosition(roomData.controller.pos.x, roomData.controller.pos.y, targetRoomName);
      const controllerDistance = this.calculateDistanceToHome(homeSpawn.pos, controllerPos, roomDistance);
      const controllerScore = Math.max(0, 5 - Math.floor(controllerDistance / 5));
      totalScore += controllerScore;

      console.log(`[房间评分] 🎮 控制器: 位置(${roomData.controller.pos.x},${roomData.controller.pos.y}), 距离主城${controllerDistance.toFixed(1)}格, 得分${controllerScore}`);
    }

    // 多矿加成
    if (sourceCount > 1) {
      const bonus = totalScore * 0.2;
      totalScore += bonus;
      console.log(`[房间评分] 🎯 多矿加成: ${sourceCount}个矿点，额外得分${bonus.toFixed(1)}`);
    }

    // 距离惩罚（房间距离越远，分数越低）
    const distancePenalty = roomDistance * 2;
    totalScore = Math.max(0, totalScore - distancePenalty);
    console.log(`[房间评分] ⚠️  距离惩罚: 房间距离${roomDistance}，扣除${distancePenalty}分`);

    console.log(`[房间评分] 📊 最终评分: ${totalScore.toFixed(1)} / 10`);

    // 评分大于8分认为适合开发
    if (totalScore >= 8) {
      console.log(`[房间评分] ✅ 推荐开发: 房间${targetRoomName}评分${totalScore.toFixed(1)}，适合开发外矿`);

      const homeRoomMemory = Memory.rooms[homeRoom.name];
      if (!homeRoomMemory.remoteMiningTargets) {
        homeRoomMemory.remoteMiningTargets = [];
      }
      if (!homeRoomMemory.remoteMiningTargets.includes(targetRoomName)) {
        homeRoomMemory.remoteMiningTargets.push(targetRoomName);
        console.log(`[房间评分] 📝 已添加到外矿目标列表`);
      }
    } else if (totalScore >= 6) {
      console.log(`[房间评分] 🟡 一般适合: 房间${targetRoomName}评分${totalScore.toFixed(1)}，可考虑开发`);
    } else {
      console.log(`[房间评分] 🔴 不适合: 房间${targetRoomName}评分${totalScore.toFixed(1)}，不建议开发`);
    }

    console.log(`[房间评分] ====== 评估完成 ======\n`);
  }

  // 计算到主城的实际距离
  private static calculateDistanceToHome(homePos: RoomPosition, targetPos: RoomPosition, roomDistance: number): number {
    // 基础距离：房间间距离 * 50（房间大小）
    let totalDistance = roomDistance * 50;

    // 如果是在同一个房间，直接计算位置距离
    if (roomDistance === 0) {
      return homePos.getRangeTo(targetPos);
    }

    // 如果跨房间，需要考虑房间边界
    // 这里简化处理，假设从房间边界到目标位置的平均距离
    const avgDistanceInRoom = 25; // 房间中心到边界的平均距离
    totalDistance += avgDistanceInRoom;

    return totalDistance;
  }

  // 计算矿点靠近出口的得分
  private static calculateExitProximityScore(sourcePos: RoomPosition, sourceRoom: string, homeRoom: string): number {
    // 找到最近的出口方向
    const exitDir = Game.map.findExit(sourceRoom, homeRoom);
    if (exitDir === ERR_NO_PATH || exitDir === ERR_INVALID_ARGS) return 0;

    // 计算矿点到出口的距离
    let exitDistance = 0;
    switch (exitDir) {
      case FIND_EXIT_TOP:
        exitDistance = sourcePos.y;
        break;
      case FIND_EXIT_BOTTOM:
        exitDistance = 49 - sourcePos.y;
        break;
      case FIND_EXIT_LEFT:
        exitDistance = sourcePos.x;
        break;
      case FIND_EXIT_RIGHT:
        exitDistance = 49 - sourcePos.x;
        break;
    }

    // 距离出口越近得分越高（最大3分）
    return Math.max(0, 3 - Math.floor(exitDistance / 10));
  }


}
