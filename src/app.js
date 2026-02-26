// src/app.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./config/db'); // <--- 引入刚才写的连接文件
const path = require('path');


require('./tasks/stockCron'); // <--- 引入定时任务文件，确保它在服务器启动时就开始工作

const app = express();
const PORT = 3000;

// 1. 连接数据库
connectDB(); // <--- 启动时连接数据库

// 2. 中间件配置
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 引入路由文件
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes'); // 引入上传路由
const hotelRoutes = require('./routes/hotelRoutes'); // 引入酒店路由
const roomRoutes = require('./routes/roomRoutes');
const adminRoutes = require('./routes/adminRoutes'); // 引入管理员路由

// 挂载路由
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/hotels', hotelRoutes); // 挂载酒店路由
app.use('/api/rooms', roomRoutes); // 挂载房型路由
app.use('/api/admin', adminRoutes); // 挂载管理员路由


app.get('/', (req, res) => {
    res.send({ message: '智慧出行酒店预订平台后端服务已启动!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.get('/', (req, res) => {
    res.send({ message: '智慧出行酒店预订平台后端服务已启动!' });
});