const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  order_no: { type: String, required: true, unique: true }, // 订单号
  
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // 下单人
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }, // 酒店快照
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },   // 房型快照

  check_in_date: Date,
  check_out_date: Date,
  night_count: Number, // 住几晚
  room_count: { type: Number, default: 1 },
  total_price: Number,

  // 入住人信息
  contact_name: String,
  contact_phone: String,

  // 0:待支付, 1:已支付, 2:已确认, 3:已取消, 4:已完成
  status: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);