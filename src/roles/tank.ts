// 坦克角色逻辑 - 简化版
export class RoleTank {
  public static run(creep: Creep): void {
    // 测试指令：检查是否有跨房间移动任务
    if (creep.memory.testMoveToRoom) {
      this.handleTestMoveTask(creep);
      return;
    }

    // 检查是否有攻击任务
    if (creep.memory.attackTarget) {
      this.handleAttackTask(creep);
      return;
    }

    // 默认巡逻
    this.patrol(creep);
  }

  // 处理测试移动任务
  private static handleTestMoveTask(creep: Creep): void {
    const targetRoom = creep.memory.testMoveToRoom!;

    // 检查是否在目标房间
    if (creep.room.name === targetRoom) {
      console.log(`[测试坦克${creep.name}] 🎉 已到达目标房间 ${targetRoom}！`);
      creep.say('🎯 已到达');
      delete creep.memory.testMoveToRoom;
      this.patrol(creep);
      return;
    }

    // 使用简化的跨房间移动
    this.moveToTargetRoom(creep, targetRoom);
  }

  // 处理攻击任务
  private static handleAttackTask(creep: Creep): void {
    const targetRoomName = creep.memory.attackTarget as string;
    const targetRoom = Game.rooms[targetRoomName];

    if (!targetRoom) {
      // 使用简化的跨房间移动
      this.moveToTargetRoom(creep, targetRoomName);
      creep.say('🚀 向目标移动');
    } else {
      // 已到达目标房间，执行战斗逻辑
      if (targetRoom.controller) {
        creep.moveTo(targetRoom.controller.pos);
        creep.say('⚔️ 攻击');
      } else {
        creep.moveTo(new RoomPosition(25, 25, targetRoom.name));
        creep.say('🎯 到中心');
      }
    }
  }

  // 简化的跨房间移动逻辑（修复moveTo缓存问题）
  private static moveToTargetRoom(creep: Creep, targetRoom: string): void {
    console.log("targetRoom", targetRoom);
    console.log("creep.room.name", creep.room.name);
    
    if (creep.room.name !== targetRoom) {
      console.log(`[Tank${creep.name}] 没有房间 ${targetRoom} 的视野，移动到房间中心`);
      
      // 清除可能存在的move缓存，避免跨房间移动卡住
      delete (creep.memory as any)._move;
      
      // 使用更可靠的跨房间移动方法
      const targetPos = new RoomPosition(25, 25, targetRoom);
      const moveResult = creep.moveTo(targetPos, {
        visualizePathStyle: { stroke: '#ff0000' },
        reusePath: 1, // 减少path缓存时间
        maxRooms: 3   // 限制最大房间数
      });
      
      if (moveResult !== OK) {
        console.log(`[Tank${creep.name}] moveTo失败: ${moveResult}，尝试寻找出口`);
        // 如果moveTo失败，手动寻找出口
        const exit = creep.room.findExitTo(targetRoom);
        if (exit && exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
          const exitPositions = creep.room.find(exit as FindConstant);
          const exitPos = creep.pos.findClosestByRange(exitPositions);
          if (exitPos) {
            creep.moveTo(exitPos);
            creep.say('🚪 找出口');
          }
        }
      } else {
        creep.say('🚀 跨房间');
      }
    } else {
      // 有视野 = 已经进入房间
      console.log(`[Tank${creep.name}] 🎉 成功进入目标房间 ${targetRoom}`);
      creep.say('✅ 已到达');
      
      // 清理攻击目标，避免重复移动
      delete creep.memory.attackTarget;
    }
  }

  // 巡逻逻辑
  private static patrol(creep: Creep): void {
    // 简单的巡逻：在房间中心附近移动
    if (creep.pos.getRangeTo(25, 25) > 10) {
      creep.moveTo(new RoomPosition(25, 25, creep.room.name));
      creep.say('🚶 巡逻');
    } else {
      // 在中心附近随机移动
      const x = 25 + Math.floor(Math.random() * 11) - 5; // 20-30
      const y = 25 + Math.floor(Math.random() * 11) - 5; // 20-30
      creep.moveTo(new RoomPosition(x, y, creep.room.name));
      creep.say('🔄 巡逻');
    }
  }
}
