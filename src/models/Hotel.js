// src/models/Hotel.js
const mongoose = require('mongoose');

// 🌟 新增：为了让“用户评价”更结构化，我们先定义一个子结构 (Subdocument)
// 这样每条评价不仅仅是一句话，还能包含用户名和评分
const reviewSchema = new mongoose.Schema({
  user_name: { type: String, default: '匿名用户' },
  content: { type: String, required: true }, // 如截图中的："酒店环境很好..."
  score: { type: Number, default: 5 },       // 这条评价的分数
  created_at: { type: Date, default: Date.now }
});

const hotelSchema = new mongoose.Schema({
  // --- 1. 基础与归属信息 ---
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name_cn: { type: String, required: true },
  brand: { type: String, default: '独立品牌' }, // 🌟 新增：品牌 (如:如家/汉庭/希尔顿)
  hotel_type: { 
    type: String, 
    enum: ['酒店', '民宿', '青年旅舍', '客栈'], 
    default: '酒店'
  },

  // --- 2. 位置信息 (细化到商圈) ---
  // 🌟 新增：国内/海外 大分类
  region_type: { 
    type: String, 
    enum: ['国内', '海外', '港澳台'], 
    default: '国内' 
  },
  // 🌟 新增：具体国家
  country: { type: String, default: '中国' },
  
  city: { type: String, required: true },
  district: { type: String }, // 行政区 (如: 黄浦区)
  business_zone: { type: String }, // 🌟 新增：商圈/区域 (如: 外滩、陆家嘴、迪士尼)
  address: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [经度, 纬度]
  },
  
  // --- 3. 价格与促销 ---
  min_price: { type: Number, default: 0 }, // 🌟 新增：基础最低价 (通常由房型模块动态计算更新，但此处需保留字段展示)
  discount: { type: Number, default: 1 },  // 🌟 新增：折扣属性 (1代表原价/无折扣，0.8代表8折)

  // --- 4. 标签与设施 (分类存放) ---
  star_rating: { type: Number, default: 0 }, // 星级
  tags: [{ type: String }],      // 🌟 分类A：特色Tag (如: 山景, 宠物友好, 独立庭院)
  services: [{ type: String }],  // 🌟 分类B：服务Tag (如: 免费停车, 含早餐, 健身房)
  
  // --- 5. 图片资源 ---
  cover_image: { type: String, required: true },
  detail_images: [{ type: String }], 

  // --- 6. 评价系统 (完美还原你的截图) ---
  score: { type: Number, default: 0 },        // 总体评分 (如截图的 4.9)
  review_count: { type: Number, default: 0 }, // 评价数量 (如截图的 586)
  review_tags: [{ type: String }],            // 评价标签 (如截图的 "干净卫生", "安静", "服务好")
  reviews: [reviewSchema],                    // 用户评价数组 (嵌套上面的 reviewSchema)

  // --- 7. 状态 ---
  status: {
    type: Number,
    default: 0 // 0:待审核, 1:已上架, 2:已下架, 3:被驳回
  },
  audit_remark: { type: String, default: '' }, // 驳回理由
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// 创建地理空间索引 (用于"查找附近"功能)
hotelSchema.index({ location: '2dsphere' });
// 针对商圈和城市创建索引，加快搜索速度
hotelSchema.index({ city: 1, business_zone: 1 });

module.exports = mongoose.model('Hotel', hotelSchema);