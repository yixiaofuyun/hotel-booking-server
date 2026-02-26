// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware'); // 引入两个保安

// 🌟 修复：给商户审核接口也加上 isAdmin 双重校验！
router.get('/merchants/pending', verifyToken, isAdmin, adminController.getPendingMerchants);
router.post('/merchants/audit', verifyToken, isAdmin, adminController.auditMerchant);

// 所有的接口都必须经过 verifyToken 和 isAdmin 双重校验
router.get('/hotels/pending', verifyToken, isAdmin, adminController.getPendingHotels);
router.patch('/hotels/:id/audit', verifyToken, isAdmin, adminController.auditHotel);

router.get('/rooms/pending', verifyToken, isAdmin, adminController.getPendingRooms);
router.patch('/rooms/:id/audit', verifyToken, isAdmin, adminController.auditRoom);

router.get('/hotels/all', verifyToken, isAdmin, adminController.getAllHotels);
router.get('/rooms/all', verifyToken, isAdmin, adminController.getAllRooms);

module.exports = router;