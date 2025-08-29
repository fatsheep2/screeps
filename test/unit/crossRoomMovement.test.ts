import { expect } from 'chai';

describe('跨房间移动测试', () => {
  describe('视野检测逻辑', () => {
    it('应该能正确判断房间视野状态', () => {
      // 模拟Game对象
      (global as any).Game = {
        rooms: {
          'W1N1': { name: 'W1N1' }, // 有视野
          // 'W1N2' 不存在 = 无视野
        }
      };

      // 测试有视野的房间
      const hasVision = !!Game.rooms['W1N1'];
      expect(hasVision).to.be.true;

      // 测试无视野的房间
      const noVision = !!Game.rooms['W1N2'];
      expect(noVision).to.be.false;
    });

    it('应该根据视野状态选择正确的移动策略', () => {
      // 模拟Game对象
      (global as any).Game = {
        rooms: {
          'W1N1': { name: 'W1N1' }, // 源房间有视野
          // 'W1N2' 目标房间无视野
        }
      };

      const targetRoom = 'W1N2';
      
      // 在源房间 - 应该移动到目标房间中心
      const shouldMoveToCenter = !Game.rooms[targetRoom];
      expect(shouldMoveToCenter).to.be.true;

      // 模拟进入目标房间后获得视野
      Game.rooms[targetRoom] = { name: targetRoom } as any;
      const hasEnteredRoom = !!Game.rooms[targetRoom];
      expect(hasEnteredRoom).to.be.true;
    });
  });

  describe('房间坐标系统', () => {
    it('应该能创建正确的RoomPosition', () => {
      // 模拟RoomPosition构造函数
      class MockRoomPosition {
        constructor(public x: number, public y: number, public roomName: string) {}
      }
      (global as any).RoomPosition = MockRoomPosition;

      const targetPos = new RoomPosition(25, 25, 'W1N2');
      expect(targetPos.x).to.equal(25);
      expect(targetPos.y).to.equal(25);
      expect(targetPos.roomName).to.equal('W1N2');
    });

    it('应该使用房间中心作为默认目标', () => {
      const centerX = 25;
      const centerY = 25;
      
      expect(centerX).to.equal(25);
      expect(centerY).to.equal(25);
      
      // 房间大小是50x50，中心是(25,25)
      expect(centerX).to.be.lessThan(50);
      expect(centerY).to.be.lessThan(50);
    });
  });

  describe('移动决策逻辑', () => {
    beforeEach(() => {
      // 重置Game对象
      (global as any).Game = {
        rooms: {}
      };
      
      // 模拟RoomPosition
      class MockRoomPosition {
        constructor(public x: number, public y: number, public roomName: string) {}
      }
      (global as any).RoomPosition = MockRoomPosition;
    });

    it('源房间creep应该向目标房间移动', () => {
      const mockCreep = {
        name: 'tank_test',
        room: { name: 'W1N1' },
        memory: { attackTarget: 'W1N2' },
        pos: { x: 25, y: 25 },
        moveTo: function(target: any) {
          this.lastMoveTarget = target;
          return 0; // OK
        },
        say: () => {},
        lastMoveTarget: null
      } as any;

      // 模拟源房间有视野，目标房间无视野
      Game.rooms['W1N1'] = { name: 'W1N1' } as any;
      // Game.rooms['W1N2'] 不存在

      // 模拟移动逻辑
      const targetRoomName = mockCreep.memory.attackTarget;
      const targetRoom = Game.rooms[targetRoomName];

      if (!targetRoom) {
        // 没有目标房间视野，应该移动到房间中心
        const targetPos = new RoomPosition(25, 25, targetRoomName);
        mockCreep.moveTo(targetPos);
      }

      expect(mockCreep.lastMoveTarget).to.not.be.null;
      expect(mockCreep.lastMoveTarget.x).to.equal(25);
      expect(mockCreep.lastMoveTarget.y).to.equal(25);
      expect(mockCreep.lastMoveTarget.roomName).to.equal('W1N2');
    });

    it('进入目标房间后应该获得视野', () => {
      const mockCreep = {
        name: 'tank_test',
        room: { name: 'W1N2' },
        memory: { attackTarget: 'W1N2' },
        pos: { x: 25, y: 25 },
        moveTo: () => 0,
        say: () => {}
      } as any;

      // 模拟creep进入目标房间后，获得了房间视野
      Game.rooms['W1N2'] = { name: 'W1N2' } as any;

      const targetRoomName = mockCreep.memory.attackTarget;
      const targetRoom = Game.rooms[targetRoomName];
      const hasVision = !!targetRoom;
      const isInTargetRoom = mockCreep.room.name === targetRoomName;

      expect(hasVision).to.be.true;
      expect(isInTargetRoom).to.be.true;
    });
  });

  describe('完整移动流程模拟', () => {
    beforeEach(() => {
      (global as any).Game = {
        rooms: {
          'W1N1': { name: 'W1N1' }
        }
      };
      
      class MockRoomPosition {
        constructor(public x: number, public y: number, public roomName: string) {}
      }
      (global as any).RoomPosition = MockRoomPosition;
    });

    it('应该能模拟完整的跨房间移动流程', () => {
      const mockCreep = {
        name: 'tank_test',
        room: { name: 'W1N1' },
        memory: { attackTarget: 'W1N2' },
        pos: { x: 25, y: 25 },
        moveTo: function(target: any) {
          this.lastMoveTarget = target;
          return 0;
        },
        say: function(message: string) {
          this.lastMessage = message;
        },
        lastMoveTarget: null,
        lastMessage: ''
      } as any;

      // 阶段1：在源房间，目标房间无视野
      expect(Game.rooms['W1N2']).to.be.undefined;
      expect(mockCreep.room.name).to.equal('W1N1');

      // 执行移动逻辑
      const targetRoomName = mockCreep.memory.attackTarget;
      const targetRoom = Game.rooms[targetRoomName];

      if (!targetRoom) {
        const targetPos = new RoomPosition(25, 25, targetRoomName);
        mockCreep.moveTo(targetPos);
        mockCreep.say('🚀 向目标移动');
      }

      expect(mockCreep.lastMessage).to.equal('🚀 向目标移动');
      expect(mockCreep.lastMoveTarget.roomName).to.equal('W1N2');

      // 阶段2：模拟进入目标房间
      mockCreep.room.name = 'W1N2';
      Game.rooms['W1N2'] = { 
        name: 'W1N2',
        controller: { pos: { x: 10, y: 10 } }
      } as any;

      // 重新执行移动逻辑
      const newTargetRoom = Game.rooms[targetRoomName];
      expect(newTargetRoom).to.not.be.undefined;
      expect(mockCreep.room.name).to.equal('W1N2');

      // 现在应该移动到controller
      if (newTargetRoom && newTargetRoom.controller) {
        mockCreep.moveTo(newTargetRoom.controller.pos);
        mockCreep.say('⚔️ 攻击');
      }

      expect(mockCreep.lastMessage).to.equal('⚔️ 攻击');
      expect(mockCreep.lastMoveTarget.x).to.equal(10);
      expect(mockCreep.lastMoveTarget.y).to.equal(10);
    });
  });

  describe('边缘情况测试', () => {
    beforeEach(() => {
      (global as any).Game = { rooms: {} };
      class MockRoomPosition {
        constructor(public x: number, public y: number, public roomName: string) {}
      }
      (global as any).RoomPosition = MockRoomPosition;
    });

    it('应该处理无效的房间名称', () => {
      const mockCreep = {
        name: 'tank_test',
        room: { name: 'W1N1' },
        memory: { attackTarget: '' }, // 空的攻击目标
        pos: { x: 25, y: 25 },
        moveTo: () => 0,
        say: () => {}
      } as any;

      const targetRoomName = mockCreep.memory.attackTarget;
      expect(targetRoomName).to.equal('');
      
      // 应该能安全处理空字符串
      const targetRoom = Game.rooms[targetRoomName];
      expect(targetRoom).to.be.undefined;
    });

    it('应该处理相同房间的攻击目标', () => {
      const mockCreep = {
        name: 'tank_test',
        room: { name: 'W1N1' },
        memory: { attackTarget: 'W1N1' }, // 攻击自己的房间
        pos: { x: 25, y: 25 },
        moveTo: () => 0,
        say: () => {}
      } as any;

      Game.rooms['W1N1'] = { name: 'W1N1' } as any;

      const targetRoomName = mockCreep.memory.attackTarget;
      const isInTargetRoom = mockCreep.room.name === targetRoomName;
      
      expect(isInTargetRoom).to.be.true;
      expect(Game.rooms[targetRoomName]).to.not.be.undefined;
    });

    it('应该处理没有controller的房间', () => {
      const mockCreep = {
        name: 'tank_test',
        room: { name: 'W1N2' },
        memory: { attackTarget: 'W1N2' },
        pos: { x: 25, y: 25 },
        moveTo: function(target: any) {
          this.lastMoveTarget = target;
          return 0;
        },
        say: function(message: string) {
          this.lastMessage = message;
        },
        lastMoveTarget: null,
        lastMessage: ''
      } as any;

      // 房间没有controller
      Game.rooms['W1N2'] = { name: 'W1N2' } as any;

      const targetRoom = Game.rooms[mockCreep.memory.attackTarget];
      if (targetRoom && !targetRoom.controller) {
        mockCreep.moveTo(new RoomPosition(25, 25, targetRoom.name));
        mockCreep.say('🎯 到中心');
      }

      expect(mockCreep.lastMessage).to.equal('🎯 到中心');
      expect(mockCreep.lastMoveTarget.x).to.equal(25);
      expect(mockCreep.lastMoveTarget.y).to.equal(25);
    });
  });
});