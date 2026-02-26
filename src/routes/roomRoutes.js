// src/routes/roomRoutes.js
const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { verifyToken, isMerchant } = require('../middlewares/authMiddleware');

// 1. 商户给酒店添加房型
router.post('/', verifyToken, isMerchant, roomController.createRoom);

// 🌟 新增：2. 修改房型 (PUT /api/rooms/某个房型的ID)
router.put('/:roomId', verifyToken, isMerchant, roomController.updateRoom);

// 🌟 新增：3. 删除房型 (DELETE /api/rooms/某个房型的ID)
router.delete('/:roomId', verifyToken, isMerchant, roomController.deleteRoom);

// 🌟 新增：4. 获取某个酒店的所有房型列表 
router.get('/hotel/:hotelId', verifyToken, isMerchant, roomController.getRoomsByHotel);

// 🌟 新增：5. 获取单个房型的详细信息 (公开接口，商户回显/用户看详情都用它)
router.get('/:roomId', roomController.getRoomDetail);

router.patch('/:roomId/status', verifyToken, isMerchant, roomController.toggleRoomStatus);

// 🌟 保持不变：这是我们后来写的，真正的 C 端专属公开接口！
router.get('/hotel/:hotelId/published', roomController.getPublishedRooms);

router.get('/:roomId/stock', verifyToken, isMerchant, roomController.getRoomStock);

module.exports = router;