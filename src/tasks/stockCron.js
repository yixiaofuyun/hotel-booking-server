// src/tasks/stockCron.js
const cron = require('node-cron');
const Room = require('../models/Room');
const RoomStock = require('../models/RoomStock');

// 🌟 核心语法：'0 2 * * *' 代表每天的凌晨 2点0分 执行
cron.schedule('0 2 * * *', async () => {
  console.log('⏳ [定时任务] 开始执行每日库存自动扩充...');
  
  try {
    // 1. 计算出 60 天后的那一天是几号
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 60); // 往后推 60 天
    
    // 格式化为 YYYY-MM-DD
    const year = futureDate.getFullYear();
    const month = String(futureDate.getMonth() + 1).padStart(2, '0');
    const day = String(futureDate.getDate()).padStart(2, '0');
    const targetDateString = `${year}-${month}-${day}`;

    // 2. 查出数据库里所有的房型
    const rooms = await Room.find();
    let addCount = 0;

    // 3. 遍历每一个房型，给它们加上那一天的库存
    for (const room of rooms) {
      // 安全起见：先查一下那天是不是已经有库存了（防止重复生成报错）
      const existStock = await RoomStock.findOne({ 
        room: room._id, 
        date: targetDateString 
      });

      if (!existStock) {
        // 如果没有，就新建一条
        await RoomStock.create({
          hotel: room.hotel,
          room: room._id,
          date: targetDateString,
          total_count: room.total_count, // 物理总数
          booked_count: 0                // 没人订
        });
        addCount++;
      }
    }

    console.log(`✅ [定时任务] 库存扩充完毕！已为 ${addCount} 个房型生成了 ${targetDateString} 的库存。`);
  } catch (error) {
    console.error('❌ [定时任务] 库存扩充失败:', error);
  }
});

module.exports = cron; // 导出即可