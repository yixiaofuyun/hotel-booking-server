// src/routes/hotelRoutes.js
const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const { verifyToken, isMerchant } = require('../middlewares/authMiddleware');

// 1. 商户发布酒店
router.post('/', verifyToken, isMerchant, hotelController.createHotel);

// 🌟 新增：2. 商户查询自己的酒店列表 (也需要双重保安)
router.get('/my-hotels', verifyToken, isMerchant, hotelController.getMyHotels);

router.get('/search', hotelController.searchHotels);
router.get('/:id', hotelController.getHotelDetail);

router.put('/:id', verifyToken, hotelController.updateHotel);

module.exports = router;