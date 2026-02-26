// src/models/RoomStock.js
const mongoose = require('mongoose');

const roomStockSchema = new mongoose.Schema({
  // 1. 关联信息：这是哪个酒店的哪个房型？
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  
  // 2. 日期标识 (格式强烈建议用 YYYY-MM-DD 的字符串，避免时区带来的坑)
  date: { type: String, required: true }, // 例如: "2026-03-01"
  
  // 3. 库存计算核心
  total_count: { type: Number, required: true }, // 当天最大物理容量 (默认等于 Room 表的 total_count)
  booked_count: { type: Number, default: 0 },    // 当天已经被预订了多少间
  
  // 4. (进阶) 节假日动态调价：如果商户想在十一黄金周涨价，可以填这个字段覆盖原价
  daily_price: { type: Number } 
  
}, { timestamps: true });

// 🌟 核心防御：联合唯一索引！
// 保证同一个房型，在同一天，绝对不可能出现两条记录，防止数据错乱。
roomStockSchema.index({ room: 1, date: 1 }, { unique: true });

// 我们还可以加一个虚拟属性，方便直接获取当前可用数量 (可用 = 总数 - 已订)
roomStockSchema.virtual('available_count').get(function() {
  return this.total_count - this.booked_count;
});

// 确保在转成 JSON 给前端时，带上虚拟属性
roomStockSchema.set('toJSON', { virtuals: true });
roomStockSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RoomStock', roomStockSchema);