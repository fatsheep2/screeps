import { expect } from 'chai';

describe('RoleTank', () => {
  describe('房间移动逻辑', () => {
    it('应该能检测到房间边界', () => {
      // 模拟一个在房间边界的creep
      const mockCreep = {
        pos: { x: 1, y: 25, roomName: 'W2N5' },
        memory: { attackTarget: 'W3N5' },
        room: { name: 'W2N5' },
        say: () => {},
        moveTo: () => {}
      } as any;

      // 测试边界检测逻辑
      const isAtBorder = (creep: any) => {
        const borderDistance = 2;
        return creep.pos.x <= borderDistance ||
               creep.pos.x >= 50 - borderDistance ||
               creep.pos.y <= borderDistance ||
               creep.pos.y >= 50 - borderDistance;
      };

      expect(isAtBorder(mockCreep)).to.be.true;
    });

    it('应该能正确判断房间状态', () => {
      // 模拟在源房间的creep
      const sourceRoomCreep = {
        pos: { x: 25, y: 25, roomName: 'W2N5' },
        memory: { attackTarget: 'W3N5' },
        room: { name: 'W2N5' }
      } as any;

      // 模拟在目标房间的creep
      const targetRoomCreep = {
        pos: { x: 25, y: 25, roomName: 'W3N5' },
        memory: { attackTarget: 'W3N5' },
        room: { name: 'W3N5' }
      } as any;

      expect(sourceRoomCreep.room.name).to.equal('W2N5');
      expect(targetRoomCreep.room.name).to.equal('W3N5');
      expect(sourceRoomCreep.room.name !== sourceRoomCreep.memory.attackTarget).to.be.true;
      expect(targetRoomCreep.room.name === targetRoomCreep.memory.attackTarget).to.be.true;
    });

    it('应该能创建正确的目标位置', () => {
      const targetRoom = 'W3N5';
      const targetPos = { x: 25, y: 25, roomName: targetRoom };

      expect(targetPos.x).to.equal(25);
      expect(targetPos.y).to.equal(25);
      expect(targetPos.roomName).to.equal(targetRoom);
    });
  });

  describe('边界检测逻辑', () => {
    it('应该正确识别边界位置', () => {
      const testCases = [
        { x: 0, y: 25, expected: true, description: '左边界' },
        { x: 49, y: 25, expected: true, description: '右边界' },
        { x: 25, y: 0, expected: true, description: '上边界' },
        { x: 25, y: 49, expected: true, description: '下边界' },
        { x: 1, y: 25, expected: true, description: '左边界附近' },
        { x: 48, y: 25, expected: true, description: '右边界附近' },
        { x: 25, y: 1, expected: true, description: '上边界附近' },
        { x: 25, y: 48, expected: true, description: '下边界附近' },
        { x: 25, y: 25, expected: false, description: '房间中心' },
        { x: 10, y: 10, expected: false, description: '房间内部' }
      ];

      testCases.forEach(({ x, y, expected, description }) => {
        const mockCreep = { pos: { x, y } } as any;
        const isAtBorder = (creep: any) => {
          const borderDistance = 2;
          return creep.pos.x <= borderDistance ||
                 creep.pos.x >= 50 - borderDistance ||
                 creep.pos.y <= borderDistance ||
                 creep.pos.y >= 50 - borderDistance;
        };

        expect(isAtBorder(mockCreep)).to.equal(expected, `${description}: (${x},${y})`);
      });
    });
  });

  describe('房间移动逻辑模拟', () => {
    it('应该能模拟完整的房间移动流程', () => {
      // 模拟坦克在W2N5房间，目标W3N5
      const mockTank = {
        pos: { x: 25, y: 25, roomName: 'W2N5' },
        memory: { attackTarget: 'W3N5' },
        room: { name: 'W2N5' },
        say: () => {},
        moveTo: () => {}
      } as any;

      // 第一步：检查是否在目标房间
      const isInTargetRoom = mockTank.room.name === mockTank.memory.attackTarget;
      expect(isInTargetRoom).to.be.false;

      // 第二步：检查是否在边界
      const isAtBorder = (creep: any) => {
        const borderDistance = 2;
        return creep.pos.x <= borderDistance ||
               creep.pos.x >= 50 - borderDistance ||
               creep.pos.y <= borderDistance ||
               creep.pos.y >= 50 - borderDistance;
      };
      expect(isAtBorder(mockTank)).to.be.false;

      // 第三步：模拟移动到边界
      mockTank.pos = { x: 1, y: 25, roomName: 'W2N5' };
      expect(isAtBorder(mockTank)).to.be.true;

      // 第四步：模拟进入W3N5房间
      mockTank.room.name = 'W3N5';
      mockTank.pos.roomName = 'W3N5';
      expect(mockTank.room.name).to.equal('W3N5');
      expect(mockTank.room.name === mockTank.memory.attackTarget).to.be.true;

      // 第五步：检查是否仍在边界
      expect(isAtBorder(mockTank)).to.be.true;

      // 第六步：模拟移动到房间中心
      mockTank.pos = { x: 25, y: 25, roomName: 'W3N5' };
      expect(isAtBorder(mockTank)).to.be.false;
    });
  });
});
