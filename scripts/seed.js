const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // <--- 1. 引入加密工具
const User = require('../src/models/User');
const Hotel = require('../src/models/Hotel');
const Room = require('../src/models/Room');
const RoomStock = require('../src/models/RoomStock');

const DB_URI = 'mongodb://127.0.0.1:27017/hotel_booking_db';

mongoose.connect(DB_URI)
  .then(() => console.log('✅ MongoDB 连接成功，开始重置数据...'))
  .catch(err => console.log('❌ 连接失败:', err));

const seedData = async () => {
  try {
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await Room.deleteMany({});
    await RoomStock.deleteMany({});
    console.log('🧹 旧数据已清空');

    // --- 2. 核心修改：生成加密密码 ---
    const salt = await bcrypt.genSalt(10);
    const adminHashedPassword = await bcrypt.hash('admin_password', salt); // 管理员密码加密
    const merchantHashedPassword = await bcrypt.hash('123', salt);         // 商户密码加密

    // 3. 创建管理员 (存入加密后的密码)
    const adminUser = await User.create({
      username: 'admin',
      password: adminHashedPassword, // <--- 使用密文
      role: 'admin',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
    });
    console.log('👑 管理员创建成功:', adminUser.username);

    // 4. 创建商户 (存入加密后的密码)
    const merchant = await User.create({
      username: 'merchant_01',
      password: merchantHashedPassword, // <--- 使用密文
      role: 'merchant',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=merchant',
      merchant_profile: {
        business_name: '希尔顿酒店集团',
        status: 1 
      }
    });
    console.log('🏪 商户创建成功:', merchant.username);

    // 5. 创建酒店 (保持不变)
    const hotelA = await Hotel.create({
      merchant: merchant._id,
      name_cn: '上海外滩华尔道夫酒店',
      city: '上海',
      district: '黄浦区',
      address: '中山东一路2号',
      location: { type: 'Point', coordinates: [121.4965, 31.2366] },
      star_rating: 5,
      score: 4.9,
      tags: ['外滩景观', '历史建筑', '豪华'],
      facilities: ['wifi', 'pool', 'gym', 'bar'],
      status: 1, 
      cover_image: 'http://localhost:3000/uploads/demo_hotel_1.jpg'
    });
    console.log('🏨 酒店数据创建成功');

    // 6. 创建房型 (保持不变)
    await Room.create({
      hotel: hotelA._id,
      title: '豪华江景大床房',
      price: 2888,
      original_price: 3500,
      area: 50,
      bed_type: '大床',
      total_count: 5
    });
    console.log('🛏️ 房型数据创建成功');

    console.log('🎉 所有数据填充完毕！请按 Ctrl+C 退出');
    setTimeout(() => { mongoose.connection.close(); }, 1000);

  } catch (error) {
    console.error('❌ 填充失败:', error);
    process.exit(1);
  }
};

seedData();