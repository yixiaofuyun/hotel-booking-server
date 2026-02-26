// src/controllers/hotelController.js
const Hotel = require('../models/Hotel');

const hotelController = {
  // ==========================================
  // 1. 商户发布/创建酒店
  // ==========================================
  async createHotel(req, res) {
    try {
      // 从保安 (verifyToken) 那里拿到操作人的 ID
      const merchantId = req.user.userId;

      // 1. 解构前端传来的丰富数据 (🌟 移除了 min_price，因为现在由系统自动计算)
      const {
        name_cn, 
        brand,           
        hotel_type, 
        region_type,     
        country,         
        city, 
        district, 
        business_zone,   
        address,
        location,
        discount,        
        star_rating, 
        tags, 
        services,        
        cover_image,   
        detail_images  
      } = req.body;

      // 2. 存入数据库
      const newHotel = await Hotel.create({
        merchant: merchantId, // 牢牢绑定这个酒店是谁发的
        name_cn,
        brand,
        hotel_type,
        region_type,
        country,
        city,
        district,
        business_zone,
        address,
        location,
        min_price: 0, // 🌟 核心修改：新建酒店强制为0，等添加房型后自动牵引更新！
        discount,
        star_rating,
        tags,
        services,
        cover_image,
        detail_images,
        status: 0 // 核心业务逻辑：新发布的酒店默认为 0 (待审核)
      });

      res.json({
        code: 0,
        message: '酒店发布成功，请等待管理员审核',
        data: { 
          hotelId: newHotel._id 
        }
      });
    } catch (error) {
      // 如果 Mongoose 校验失败（比如少了必填项），会在这里被捕获
      res.status(500).json({ code: 500, message: '酒店发布失败', error: error.message });
    }
  },

  // ==========================================
  // 🌟 2. 商户查询自己名下的所有酒店
  // ==========================================
  async getMyHotels(req, res) {
    try {
      // 从保安那里知道当前是谁在查
      const merchantId = req.user.userId;
      
      // 去数据库里找所有 merchant 字段等于当前商户 ID 的酒店
      const hotels = await Hotel.find({ merchant: merchantId }).sort({ createdAt: -1 });

      res.json({
        code: 0,
        message: '查询成功',
        data: {
          total: hotels.length, // 告诉前端一共查到了几家店
          list: hotels          // 具体的酒店数组
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '查询失败', error: error.message });
    }
  },

  // ==========================================
  // 🌟 新增：3. 商户修改/编辑酒店信息
  // ==========================================
  async updateHotel(req, res) {
    try {
      // 1. 从保安那拿到当前登录的商户ID，从 URL 拿到要修改的酒店ID
      const merchantId = req.user.userId;
      const { id } = req.params; 
      const updates = req.body; // 前端传过来的新数据

      // 2. 去数据库把这家旧酒店查出来
      const hotel = await Hotel.findById(id);
      if (!hotel) {
        return res.status(404).json({ code: 404, message: '找不到该酒店' });
      }

      // 🌟 安全校验 1：防越权！只能改自己的酒店
      if (hotel.merchant.toString() !== merchantId) {
        return res.status(403).json({ code: 403, message: '无权操作：只能修改您自己名下的酒店' });
      }

      // 🚫 安全防御 2：黑名单剔除（绝不允许商户手动改的字段）
      delete updates._id;         // 不准改主键
      delete updates.merchant;    // 不准转移归属人
      delete updates.min_price;   // 🌟 绝对不准改！最低价必须由房型系统自动算！
      
      // 🌟 核心风控：只要改了信息，强制打回“待审核”状态！
      // （如果你的业务允许商户修改基本信息不影响售卖，可以注释掉下面这行）
      updates.status = 0; 

      // 3. 执行更新 ( { new: true } 表示返回更新后的最新数据 )
      const updatedHotel = await Hotel.findByIdAndUpdate(id, updates, { new: true });

      res.json({
        code: 0,
        message: '酒店信息修改成功，已重新提交审核',
        data: { hotel: updatedHotel }
      });

    } catch (error) {
      res.status(500).json({ code: 500, message: '修改酒店信息失败', error: error.message });
    }
  },

  // ==========================================
  // 🌟 终极版：4. C端公开接口 1 - 复杂搜索与推荐引擎
  // ==========================================
  async searchHotels(req, res) {
    try {
      // 1. 解构前端传来的海量查询参数 (Query)
      const {
        // 🌟 分页参数，默认查第1页，每页10条
        page = 1, 
        limit = 10,

        // --- 日期与人数库存要求 ---
        startDate, endDate, roomCount = 1, guestCount = 2,
        
        // --- 酒店维度过滤 ---
        city, keyword, brand, business_zone, hotel_type, region_type, minScore, hotel_services,
        
        // --- 房型维度过滤 ---
        minPrice, maxPrice, minArea, maxArea, breakfast, room_facilities,

        // 🌟 独立且自由的排序双参数！
        sortBy,     // 前端传 'price' 或 'rating'
        sortOrder   // 前端传 'asc' 或 'desc'
      } = req.query;

      // ======================================================
      // 步骤 A：构建酒店维度的基础查询条件 & 动态排序
      // ======================================================
      const hotelMatch = { status: 1 }; // 必须是已上架的酒店

      if (city) hotelMatch.city = city;
      if (brand) hotelMatch.brand = brand;
      if (hotel_type) hotelMatch.hotel_type = hotel_type;
      if (region_type) hotelMatch.region_type = region_type;
      if (minScore) hotelMatch.score = { $gte: Number(minScore) }; // 评分大于等于
      
      // 设施过滤 (例如传了 "洗衣房,健身房"，则酒店必须同时包含这两个)
      if (hotel_services) {
        hotelMatch.services = { $all: hotel_services.split(',') }; 
      }

      // 关键字混合搜索 (匹配酒店名、地址或商圈，例如搜"外滩")
      if (keyword || business_zone) {
        const searchKey = keyword || business_zone;
        hotelMatch.$or = [
          { name_cn: new RegExp(searchKey, 'i') },
          { business_zone: new RegExp(searchKey, 'i') },
          { address: new RegExp(searchKey, 'i') }
        ];
      }

      // 🌟 构建 Mongoose 查询对象
      let hotelQuery = Hotel.find(hotelMatch).lean(); 

      // ======================================================
      // 🌟 核心修复：完美适配 React 前端的排序引擎映射
      // ======================================================
      let dbSortField = 'createdAt'; // 默认排序字段
      let dbSortDir = -1;            // 默认排序方向 (降序)

      // 1. 翻译字段名：把前端的词汇翻译成数据库的真实字段
      if (sortBy === 'price') {
        dbSortField = 'min_price';
      } else if (sortBy === 'rating') {
        dbSortField = 'score'; // 假设 C端评分按 score 字段排
      } else if (['min_price', 'score', 'star_rating', 'createdAt'].includes(sortBy)) {
        dbSortField = sortBy; // 兼容直接传数据库字段名的情况
      }

      // 2. 翻译升降序
      if (sortOrder === 'asc') {
        dbSortDir = 1;
      } else if (sortOrder === 'desc') {
        dbSortDir = -1;
      }

      // 应用排序
      hotelQuery = hotelQuery.sort({ [dbSortField]: dbSortDir });

      // 执行酒店查询
      let hotels = await hotelQuery;
      
      if (hotels.length === 0) return res.json({ code: 0, data: { total: 0, list: [] } });

      // ======================================================
      // 步骤 B：构建房型维度的查询条件，并拉取房型
      // ======================================================
      const Room = require('../models/Room');
      const RoomStock = require('../models/RoomStock'); // 确保顶部引入了这两个模型
      
      const hotelIds = hotels.map(h => h._id);
      const roomMatch = {
        hotel: { $in: hotelIds },
        status: 1,            // 平台审核通过 
        is_published: true    // 商户未隐藏
      };

      // 价格区间
      if (minPrice || maxPrice) {
        roomMatch.price = {};
        if (minPrice) roomMatch.price.$gte = Number(minPrice);
        if (maxPrice) roomMatch.price.$lte = Number(maxPrice);
      }
      
      // 面积区间
      if (minArea || maxArea) {
        roomMatch.area = {};
        if (minArea) roomMatch.area.$gte = Number(minArea);
        if (maxArea) roomMatch.area.$lte = Number(maxArea);
      }

      // 是否含早餐 (如要求 "双早")
      if (breakfast) roomMatch.breakfast = breakfast;

      // 房间设施过滤 (如 "海景阳台,浴缸")
      if (room_facilities) {
        roomMatch.facilities = { $all: room_facilities.split(',') };
      }

      // 🌟 容量加权初筛：该房型最大容纳人数 * 需要的房间数 >= 客户总人数
      const requiredRooms = Number(roomCount);
      const requiredGuests = Number(guestCount);
      roomMatch.max_guests = { $gte: Math.ceil(requiredGuests / requiredRooms) };

      // 查出所有符合条件的房型
      const validRooms = await Room.find(roomMatch).lean();
      
      // ======================================================
      // 步骤 C：日历库存连贯性校验 (最难的一步，真正的 OTA 逻辑)
      // ======================================================
      let finalAvailableRooms = validRooms;

      if (startDate && endDate) {
        finalAvailableRooms = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // 算出入住的每一天 (不包含离店那天)
        const dateStrings = [];
        for (let d = start; d < end; d.setDate(d.getDate() + 1)) {
           const yyyy = d.getFullYear();
           const mm = String(d.getMonth() + 1).padStart(2, '0');
           const dd = String(d.getDate()).padStart(2, '0');
           dateStrings.push(`${yyyy}-${mm}-${dd}`);
        }

        // 遍历刚才查出的房型，去日历库存表里看这几天有没有断房
        for (const room of validRooms) {
          // 查出该房型在这几天的库存记录
          const stocks = await RoomStock.find({
            room: room._id,
            date: { $in: dateStrings }
          }).lean();

          // 如果库存天数对不上 (比如缺了某一天的数据)，或者某一天剩余可用 < 要求的房间数，直接淘汰！
          const isAvailable = stocks.length === dateStrings.length && stocks.every(stock => {
            return (stock.total_count - stock.booked_count) >= requiredRooms;
          });

          if (isAvailable) {
            finalAvailableRooms.push(room);
          }
        }
      }

      // ======================================================
      // 步骤 D：数据组装与剔除无房酒店
      // ======================================================
      // 把最后活下来的房型，按 hotelId 分组
      const roomsByHotel = {};
      finalAvailableRooms.forEach(room => {
        if (!roomsByHotel[room.hotel]) roomsByHotel[room.hotel] = [];
        roomsByHotel[room.hotel].push(room);
      });

      // 🌟 JavaScript 的 filter 会完美保留我们在步骤 A 数据库里的排序结果！
      // 过滤掉那些“虽然符合酒店条件，但是里面没有符合条件/没有库存的房型”的酒店
      const finalHotels = hotels
        .filter(hotel => roomsByHotel[hotel._id] && roomsByHotel[hotel._id].length > 0)
        .map(hotel => {
          // 顺便把找到的可用房型挂载到酒店数据下，返回给前端展示
          hotel.available_rooms = roomsByHotel[hotel._id];
          return hotel;
        });

      // ======================================================
      // 🌟 步骤 E：对活下来的真实数据进行内存切片分页
      // ======================================================
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = pageNum * limitNum;

      // 截取当前页的数据
      const paginatedHotels = finalHotels.slice(startIndex, endIndex);

      res.json({
        code: 0,
        message: '高级检索成功',
        data: {
          total: finalHotels.length,           // 满足条件的真实总数 (前端用来算总页数)
          page: pageNum,                       // 当前页码
          limit: limitNum,                     // 每页条数
          totalPages: Math.ceil(finalHotels.length / limitNum), // 总页数
          list: paginatedHotels                // 🌟 只返回当前页的酒店数组
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '搜索酒店失败', error: error.message });
    }
  },

  // ==========================================
  // 🌟 5. C端公开接口 2 - 获取酒店详情
  // ==========================================
  async getHotelDetail(req, res) {
    try {
      const { id } = req.params;
      
      const hotel = await Hotel.findById(id);
      if (!hotel) {
        return res.status(404).json({ code: 404, message: '找不到该酒店' });
      }

      // 也可以加个判断：如果该酒店被下架了，提示C端用户已下架
      if (hotel.status !== 1) {
         return res.status(403).json({ code: 403, message: '该酒店已下架或暂停营业' });
      }

      res.json({
        code: 0,
        message: '查询成功',
        data: { hotel }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '获取详情失败', error: error.message });
    }
  }
};

module.exports = hotelController;