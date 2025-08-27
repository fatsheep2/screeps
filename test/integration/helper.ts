/*
 * 简化的集成测试辅助类
 * 由于screeps-server-mockup安装问题，我们使用简化的模拟环境
 */
class SimpleIntegrationTestHelper {
  private _gameTime: number = 0;
  private _memory: any = { creeps: {}, rooms: {} };
  private _creeps: any = {};
  private _rooms: any = {};

  get gameTime() {
    return this._gameTime;
  }

  get memory() {
    return this._memory;
  }

  set memory(value: any) {
    this._memory = value;
  }

  get creeps() {
    return this._creeps;
  }

  get rooms() {
    return this._rooms;
  }

  async beforeEach() {
    this._gameTime = 0;
    this._memory = { creeps: {}, rooms: {} };
    this._creeps = {};
    this._rooms = {};

    // 模拟基础房间设置
    this._rooms.W0N1 = {
      name: 'W0N1',
      energyAvailable: 300,
      energyCapacityAvailable: 550
    };

    console.log('简化的集成测试环境已初始化');
  }

  async afterEach() {
    this._gameTime = 0;
    this._memory = { creeps: {}, rooms: {} };
    this._creeps = {};
    this._rooms = {};
    console.log('简化的集成测试环境已清理');
  }

  async tick() {
    this._gameTime++;
    console.log(`游戏tick: ${this._gameTime}`);

    // 模拟游戏逻辑
    this.simulateGameLogic();
  }

  private simulateGameLogic() {
    // 模拟Creep的基本行为
    for (const creepId in this._creeps) {
      const creep = this._creeps[creepId];
      if (creep.memory && creep.memory.role) {
        // 模拟不同角色的基本行为
        switch (creep.memory.role) {
          case 'upgrader':
            // 模拟升级者行为
            break;
          case 'builder':
            // 模拟建筑者行为
            break;
          case 'carrier':
            // 模拟搬运工行为
            break;
          case 'tank':
            // 模拟坦克行为
            break;
        }
      }
    }
  }

  // 模拟添加Creep
  addCreep(name: string, role: string, room: string, x: number, y: number) {
    const creep = {
      id: name,
      name,
      memory: { role, room, working: false },
      pos: { x, y, roomName: room },
      room: { name: room },
      hits: 100,
      hitsMax: 100,
      fatigue: 0
    };

    this._creeps[name] = creep;
    this._memory.creeps[name] = creep.memory;

    console.log(`添加Creep: ${name} (${role}) 在房间 ${room}`);
    return creep;
  }

  // 模拟添加房间对象
  addRoomObject(room: string, type: string, x: number, y: number, data: any) {
    const id = `${type}_${room}_${x}_${y}`;
    const obj = {
      id,
      type,
      room,
      x,
      y,
      ...data
    };

    if (!this._rooms[room]) {
      this._rooms[room] = { name: room };
    }

    console.log(`添加房间对象: ${type} 在房间 ${room} (${x}, ${y})`);
    return obj;
  }

  // 模拟获取房间对象
  get roomObjects() {
    const objects: any[] = [];

    // 添加Creep
    for (const creep of Object.values(this._creeps)) {
      objects.push(creep);
    }

    // 添加其他房间对象（这里可以扩展）

    return objects;
  }
}

beforeEach(async () => {
  await helper.beforeEach();
});

afterEach(async () => {
  await helper.afterEach();
});

export const helper = new SimpleIntegrationTestHelper();
