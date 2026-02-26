// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 引入我们刚刚写的保安
const { verifyToken } = require('../middlewares/authMiddleware');

// === 之前写好的公开接口（不需要保安） ===
router.post('/register/merchant', authController.registerMerchant);
router.post('/register/customer', authController.registerCustomer);
router.post('/login', authController.login);

// === 新增：需要受保护的接口 ===
// 注意看！我们在路径和 Controller 之间，插入了 verifyToken！
router.get('/me', verifyToken, authController.getMe); 

// 新增：修改个人信息 (PUT 请求常用于更新操作)
router.put('/update', verifyToken, authController.updateProfile);

router.post('/certify', verifyToken, authController.submitCertify);

module.exports = router;