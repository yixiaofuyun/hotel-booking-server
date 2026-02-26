// src/controllers/roomController.js
const Room = require('../models/Room');
const Hotel = require('../models/Hotel');
const RoomStock = require('../models/RoomStock'); // 🌟 引入刚建好的库存表

// ==========================================
// 🌟 终极版辅助函数：只计算“可售卖”房型的最低价
// ==========================================
async function syncHotelMinPrice(hotelId) {
  try {
    // 🌟 核心升级：只找“已审核(status: 1)”且“已上架(is_published: true)”的房型！
    const lowestRoom = await Room.findOne({ 
      hotel: hotelId,
      status: 1,
      is_published: true
    }).sort({ price: 1 });
    
    // 如果找不到可售房型（比如全下架了），最低价归零；否则取找到的最低价
    const newMinPrice = lowestRoom ? lowestRoom.price : 0;
    
    // 更新酒店表的 min_price
    await Hotel.findByIdAndUpdate(hotelId, { min_price: newMinPrice });
    console.log(`酒店 ${hotelId} 的C端最低价已同步更新为: ${newMinPrice}`);
  } catch (error) {
    console.error('同步酒店最低价失败:', error);
  }
}

const roomController = {
  // 1. 商户添加房型并自动生成库存
  async createRoom(req, res) {
    try {
      const merchantId = req.user.userId;
      const { hotelId, ...roomData } = req.body;

      // 🌟 安全校验：酒店存不存在？是不是这个商户的？
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        return res.status(404).json({ code: 404, message: '找不到指定的酒店' });
      }
      if (hotel.merchant.toString() !== merchantId) {
        return res.status(403).json({ code: 403, message: '无权操作：只能给您自己名下的酒店添加房型' });
      }

      // ==========================================
      // 🌟 新增风控：酒店必须是“审核通过(1)”状态才能加房型！
      // ==========================================
      if (hotel.status !== 1) {
        return res.status(403).json({ 
          code: 403, 
          message: '操作被拒绝：该酒店尚未通过平台审核，暂不能添加房型！' 
        });
      }

      // 1. 创建物理房型
      const newRoom = await Room.create({
        hotel: hotelId,
        ...roomData
      });

      // ==========================================
      // 🌟 核心升级：自动生成未来 60 天的日历库存！
      // ==========================================
      const stockRecords = []; // 用来装这 60 天的数据的空数组
      const today = new Date();
      
      for (let i = 0; i < 60; i++) {
        // 计算未来的每一天
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + i); // 每次往后推 i 天
        
        // 把日期格式化为标准的 YYYY-MM-DD 字符串 (防时区坑)
        const year = futureDate.getFullYear();
        const month = String(futureDate.getMonth() + 1).padStart(2, '0');
        const day = String(futureDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        // 把这一天的数据准备好，塞进数组里
        stockRecords.push({
          hotel: hotelId,
          room: newRoom._id,
          date: dateString,
          total_count: newRoom.total_count, // 从刚才建的房型里拿总数
          booked_count: 0                   // 刚建好，肯定没人订
        });
      }

      // 🌟 批量插入！使用 insertMany 比一条一条 save() 快几百倍
      await RoomStock.insertMany(stockRecords);

      // 🌟 新增：房型添加成功，可能拉低了酒店最低价，触发同步计算
      await syncHotelMinPrice(hotelId);

      res.json({
        code: 0,
        message: '房型添加成功，并已自动生成未来60天的库存',
        data: { roomId: newRoom._id }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '房型添加失败', error: error.message });
    }
  },

  // ==========================================
  // 🌟 新增：2. 商户修改房型
  // ==========================================
  async updateRoom(req, res) {
    try {
      const merchantId = req.user.userId;
      const { roomId } = req.params; // 从 URL 路径里拿到要修改的房型 ID
      const updates = req.body;      // 拿到前端传过来的新数据

      // 1. 查出这个房型，顺便把关联的酒店信息也拉出来 (populate)，为了查核商户身份
      const room = await Room.findById(roomId).populate('hotel');
      if (!room) {
        return res.status(404).json({ code: 404, message: '找不到该房型' });
      }

      // 🌟 安全校验：防越权！这个房型所属的酒店，是当前登录商户的吗？
      if (room.hotel.merchant.toString() !== merchantId) {
        return res.status(403).json({ code: 403, message: '无权操作该房型' });
      }

      // ==========================================
      // 🌟 新增风控：必须是“已下架”状态才能修改！
      // ==========================================
      if (room.is_published === true) {
        return res.status(400).json({ 
          code: 400, 
          message: '拒绝修改：该房型目前正在上架售卖中。请先将其隐藏(下架)，再进行修改！' 
        });
      }

      // 🚫 安全防御：剔除绝对不允许商户修改的敏感字段 (黑名单模式)
      delete updates.status;         // 不准改状态
      delete updates.audit_remark;   // 不准改审核评语
      delete updates.hotel;          // 不准转移酒店归属
      delete updates._id;            // 不准改数据库主键

      // 🌟 核心风控逻辑：只要商户修改了信息，强制打回待审核，清空评语，并强制剥夺上架状态！
      updates.status = 0; 
      updates.audit_remark = '';
      updates.is_published = false; 

      // 2. 更新房型基础信息
      const updatedRoom = await Room.findByIdAndUpdate(roomId, updates, { new: true });

      // 🌟 核心库存联动逻辑：如果商户修改了物理房间总数 (total_count)
      if (updates.total_count && updates.total_count !== room.total_count) {
        // 算出今天的日期字符串 (如: "2026-02-23")
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        // 把从今天起，所有未来的日历库存的 total_count 全部同步更新！
        await RoomStock.updateMany(
          { room: roomId, date: { $gte: todayStr } }, 
          { $set: { total_count: updates.total_count } }
        );
      }

      // 🌟 新增核心价格联动逻辑：如果商户修改了价格，重新计算酒店的最低价
      if (updates.price !== undefined) {
        await syncHotelMinPrice(room.hotel._id); 
      }

      res.json({
        code: 0,
        message: '房型修改成功，并已同步更新未来库存',
        data: { room: updatedRoom }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '修改失败', error: error.message });
    }
  },

  // ==========================================
  // 🌟 新增：3. 商户删除房型
  // ==========================================
  async deleteRoom(req, res) {
    try {
      const merchantId = req.user.userId;
      const { roomId } = req.params;

      const room = await Room.findById(roomId).populate('hotel');
      if (!room) {
        return res.status(404).json({ code: 404, message: '房型不存在' });
      }

      if (room.hotel.merchant.toString() !== merchantId) {
        return res.status(403).json({ code: 403, message: '无权操作该房型' });
      }

      // ==========================================
      // 🌟 新增风控：必须是“已下架”状态才能删除！
      // ==========================================
      if (room.is_published === true) {
        return res.status(400).json({ 
          code: 400, 
          message: '拒绝删除：该房型目前正在上架售卖中。为防止C端订单异常，请先将其隐藏(下架)，再进行彻底删除！' 
        });
      }

      // 🌟 专业做法：先销毁未来的所有库存，再销毁房型本身！
      await RoomStock.deleteMany({ room: roomId });
      await Room.findByIdAndDelete(roomId);

      // 🌟 新增：如果删掉的刚好是最便宜的房间，酒店最低价可能要涨上去，触发同步计算
      await syncHotelMinPrice(room.hotel._id);

      res.json({
        code: 0,
        message: '房型及相关库存已彻底删除'
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '删除失败', error: error.message });
    }
  },

  // ==========================================
  // 🌟 新增：4. 查询某个酒店下的所有房型 (列表展示)
  // ==========================================
  async getRoomsByHotel(req, res) {
    try {
      const { hotelId } = req.params; // 拿到网址上的酒店ID
      
      // 去数据库里找所有 hotel 字段等于这个 ID 的房型
      const rooms = await Room.find({ hotel: hotelId }).sort({ createdAt: -1 });

      res.json({
        code: 0,
        message: '查询成功',
        data: {
          total: rooms.length,
          list: rooms
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '查询房型列表失败', error: error.message });
    }
  },

  // ==========================================
  // 🌟 新增：5. 查询单个房型详情 (用于商户修改前的"数据回显")
  // ==========================================
  async getRoomDetail(req, res) {
    try {
      const { roomId } = req.params; // 拿到网址上的房型ID

      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({ code: 404, message: '找不到该房型' });
      }

      res.json({
        code: 0,
        message: '查询成功',
        data: { room }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '查询房型详情失败', error: error.message });
    }
  },

  // ==========================================
  // 🌟 新增：6. 商户隐藏(下架) / 恢复(重新申请上架) 房型
  // ==========================================
  async toggleRoomStatus(req, res) {
    try {
      const merchantId = req.user.userId;
      const { roomId } = req.params;
      const { action } = req.body; // 前端传 'hide' (下架) 或 'recover' (恢复)

      const room = await Room.findById(roomId).populate('hotel');
      if (!room) return res.status(404).json({ code: 404, message: '找不到该房型' });
      if (room.hotel.merchant.toString() !== merchantId) {
        return res.status(403).json({ code: 403, message: '无权操作' });
      }

      if (action === 'hide') {
        room.is_published = false; 
        await room.save();
        
        // 🌟 价格联动：如果下架的刚好是最便宜的特价房，酒店起步价得涨上去！
        await syncHotelMinPrice(room.hotel._id);
        
        return res.json({ code: 0, message: '房型已隐藏，已同步刷新酒店起步价' });
      } 

      if (action === 'recover') {
        // ==========================================
        // 🌟 终极风控：必须是“已过审(1)”状态，才能上架！
        // ==========================================
        if (room.status !== 1) {
          return res.status(403).json({ 
            code: 403, 
            message: '拒绝上架：该房型尚未通过平台审核或已被驳回，无法上架售卖！' 
          });
        }
        
        room.is_published = true; // 恢复上架意愿
        await room.save();
        
        // 🌟 价格联动：如果上架的是个超低特价房，酒店起步价得降下来！
        await syncHotelMinPrice(room.hotel._id);
        
        return res.json({ code: 0, message: '房型已成功上架，已同步刷新酒店起步价' });
      }

      res.status(400).json({ code: 400, message: '未知的操作类型' });
    } catch (error) {
      res.status(500).json({ code: 500, message: '操作失败', error: error.message });
    }
  },

  // 7. C端专属：获取酒店下可售卖的房型
  async getPublishedRooms(req, res) {
    try {
      const { hotelId } = req.params;
      
      // 🌟 终极双重风控条件！
      const rooms = await Room.find({ 
        hotel: hotelId, 
        status: 1,             // 🌟 修正：匹配模型里的 status 字段，必须是平台审核通过的
        is_published: true     // 必须是：商户没有隐藏的
      }).sort({ price: 1 });

      res.json({
        code: 0,
        message: '查询成功',
        data: {
          total: rooms.length,
          list: rooms
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '查询失败', error: error.message });
    }
  },
  // 8. 商户查询某个房型未来一段时间的日历库存
  async getRoomStock(req, res) {
    try {
      const { roomId } = req.params;
      
      // 算出今天的日期字符串 (如: "2026-02-23")
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      // 查询从今天开始往后的所有库存记录，按日期升序排列
      const stocks = await RoomStock.find({ 
        room: roomId, 
        date: { $gte: todayStr } 
      }).sort({ date: 1 });

      res.json({
        code: 0,
        message: '获取库存成功',
        data: { list: stocks }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '获取库存失败', error: error.message });
    }
  }
};

module.exports = roomController;