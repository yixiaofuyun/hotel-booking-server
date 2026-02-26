// src/models/Room.js
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  // 🌟 核心关联：这个房型属于哪个酒店？
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  
  // --- 基础信息 ---
  title: { type: String, required: true },       // 房型名称 (如：豪华海景大床房)
  price: { type: Number, required: true },       // 当前售价 (如：1299)
  original_price: { type: Number },              // 划线原价 (如：1899，用于做促销展示)
  
  // --- 房间属性 ---
  bed_type: { type: String, required: true },    // 床型 (如：1张1.8m大床)
  area: { type: Number, required: true },        // 面积 (平方米，如：45)
  has_bathtub: { type: Boolean, default: false },
  window_status: {                               // 窗户情况
    type: String, 
    enum: ['有窗', '无窗', '部分有窗'], 
    default: '有窗' 
  },
  breakfast: {                                   // 早餐包含情况
    type: String, 
    enum: ['无早', '单早', '双早', '多早'], 
    default: '双早' 
  },
  max_guests: { type: Number, default: 2 },      // 最多入住人数
  
  // --- 图片与设施 ---
  images: [{ type: String }],                    // 房型轮播图
  facilities: [{ type: String }],                // 房间内设施 (如：浴缸, 智能马桶, 投影仪)
  
  // --- 库存 ---
  total_count: { type: Number, required: true, default: 1 }, // 该房型物理房间总数 (非常重要，后面算库存全靠它)

  // ==========================================
  // 🌟 新增：企业级状态机与风控字段
  // ==========================================
  status: {
    type: Number,
    default: 0 
    // 状态字典：
    // 0: 待审核 (新建或修改后，等待管理员审批)
    // 1: 已上架 (审核通过，C端用户可见可预订)
    // 2: 已下架 (商户自己隐藏/暂停售卖，C端不可见)
    // 3: 被驳回 (管理员审核不通过)
  },
  audit_remark: {
    type: String,
    default: '' // 如果被驳回，管理员填写的驳回理由（比如：“图片模糊，请重新上传”）
  },
  // 👇 把这几行加进去
  is_published: {
    type: Boolean,
    default: false // 默认添加房型后，商户意愿是上架的
  },
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);