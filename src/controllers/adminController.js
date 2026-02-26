// src/controllers/adminController.js
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const User = require('../models/User');

const adminController = {
  // ==========================================
  // 1. 获取所有【待审核】的酒店列表
  // ==========================================
  async getPendingHotels(req, res) {
    try {
      // 查出所有 status 为 0 的酒店，并且把提交申请的商户信息带出来
      const hotels = await Hotel.find({ status: 0 })
        .populate('merchant', 'username email') 
        .sort({ createdAt: -1 });

      res.json({ code: 0, message: '查询成功', data: { total: hotels.length, list: hotels } });
    } catch (error) {
      res.status(500).json({ code: 500, message: '获取待审核酒店失败', error: error.message });
    }
  },

  // ==========================================
  // 2. 审核酒店 (通过 / 驳回)
  // ==========================================
  async auditHotel(req, res) {
    try {
      const { id } = req.params;
      const { action, remark } = req.body; // 前端传 'approve'(通过) 或 'reject'(驳回)

      const hotel = await Hotel.findById(id);
      if (!hotel) return res.status(404).json({ code: 404, message: '找不到该酒店' });

      if (action === 'approve') {
        hotel.status = 1; // 1: 已上架
        hotel.audit_remark = '';
      } else if (action === 'reject') {
        hotel.status = 3; // 3: 被驳回
        hotel.audit_remark = remark || '不符合平台规范，请修改后重新提交';
      } else {
        return res.status(400).json({ code: 400, message: '未知的审核操作' });
      }

      await hotel.save();
      res.json({ code: 0, message: `酒店已${action === 'approve' ? '通过审核并上架' : '驳回'}` });
    } catch (error) {
      res.status(500).json({ code: 500, message: '审核酒店失败', error: error.message });
    }
  },

  // ==========================================
  // 3. 获取所有【待审核】的房型列表
  // ==========================================
  async getPendingRooms(req, res) {
    try {
      // 🌟 核心修正：匹配最新的 Room 模型，字段名是 status，0代表待审核
      const rooms = await Room.find({ status: 0 })
        .populate('hotel', 'name_cn merchant') // 顺便把酒店名和商户信息带出来
        .sort({ createdAt: -1 });

      res.json({ code: 0, message: '查询成功', data: { total: rooms.length, list: rooms } });
    } catch (error) {
      res.status(500).json({ code: 500, message: '获取待审核房型失败', error: error.message });
    }
  },

  // ==========================================
  // 4. 审核房型 (通过 / 驳回)
  // ==========================================
  async auditRoom(req, res) {
    try {
      const { id } = req.params;
      const { action, remark } = req.body;

      const room = await Room.findById(id);
      if (!room) return res.status(404).json({ code: 404, message: '找不到该房型' });

      if (action === 'approve') {
        room.status = 1; // 🌟 修正：1 代表审核通过
        room.audit_remark = '';
      } else if (action === 'reject') {
        room.status = 3; // 🌟 修正：在我们最新的模型里，3 才是被驳回，2 是商户自己下架
        room.audit_remark = remark || '图片或房型信息不合规';
        room.is_published = false; // 🌟 强力风控：被驳回的房型强制剥夺上架状态
      } else {
        return res.status(400).json({ code: 400, message: '未知的审核操作' });
      }

      await room.save();
      res.json({ code: 0, message: `房型已${action === 'approve' ? '通过审核' : '驳回'}` });
    } catch (error) {
      res.status(500).json({ code: 500, message: '审核房型失败', error: error.message });
    }
  },

  // ==========================================
  // 5. 获取所有“待审核”的商户列表
  // ==========================================
  async getPendingMerchants(req, res) {
    try {
      // 去数据库里捞人：必须是商户，且状态是 1 (待审核)
      const merchants = await User.find({
        role: 'merchant',
        'merchant_profile.status': 1
      }).select('-password'); // 保护隐私，千万别把密码查出来

      res.json({
        code: 0,
        message: '获取待审核列表成功',
        data: merchants
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '服务器错误', error: error.message });
    }
  },

  // ==========================================
  // 6. 提交商户审核结果 (通过 或 驳回)
  // ==========================================
  async auditMerchant(req, res) {
    try {
      // merchantId: 要审核的商户ID; status: 2(通过) 或 3(驳回); remark: 驳回理由(可选)
      const { merchantId, status, remark } = req.body;

      if (![2, 3].includes(status)) {
        return res.status(400).json({ code: 400, message: '非法的审核状态' });
      }

      const user = await User.findById(merchantId);
      if (!user || user.role !== 'merchant') {
        return res.status(404).json({ code: 404, message: '找不到该商户' });
      }

      // 核心：更新状态
      user.merchant_profile.status = status;
      // 如果是驳回，必须记录驳回理由
      if (status === 3) {
        user.merchant_profile.audit_remark = remark || '资料不合规，请重新提交';
      } else {
        user.merchant_profile.audit_remark = ''; // 通过的话清空理由
      }

      await user.save();

      res.json({
        code: 0,
        message: status === 2 ? '商户审核已通过！' : '商户已被驳回！'
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '服务器错误', error: error.message });
    }
  },
  // ==========================================
  // 7. 获取平台所有酒店大盘 (上帝视角)
  // ==========================================
  async getAllHotels(req, res) {
    try {
      const { status } = req.query; // 允许前端传状态来过滤
      const query = {};
      if (status !== undefined && status !== '') {
        query.status = Number(status);
      }

      const hotels = await Hotel.find(query)
        .populate('merchant', 'username') // 把商户名字带出来
        .sort({ createdAt: -1 });

      res.json({ code: 0, message: '查询成功', data: { total: hotels.length, list: hotels } });
    } catch (error) {
      res.status(500).json({ code: 500, message: '获取全部酒店失败', error: error.message });
    }
  },

  // ==========================================
  // 8. 获取平台所有房型大盘 (上帝视角)
  // ==========================================
  async getAllRooms(req, res) {
    try {
      const { status, is_published } = req.query;
      const query = {};
      if (status !== undefined && status !== '') query.status = Number(status);
      if (is_published !== undefined && is_published !== '') query.is_published = is_published === 'true';

      const rooms = await Room.find(query)
        .populate('hotel', 'name_cn') // 把酒店名字带出来
        .sort({ createdAt: -1 });

      res.json({ code: 0, message: '查询成功', data: { total: rooms.length, list: rooms } });
    } catch (error) {
      res.status(500).json({ code: 500, message: '获取全部房型失败', error: error.message });
    }
  },
};

module.exports = adminController;