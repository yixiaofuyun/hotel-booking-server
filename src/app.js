// src/app.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000; // 后端服务端口

// 1. 中间件配置
app.use(cors()); // 允许跨域，方便前端成员A调用
app.use(bodyParser.json()); // 解析JSON格式请求体
app.use(bodyParser.urlencoded({ extended: true }));

// 2. 测试路由 (这一步是为了证明服务器活著)
app.get('/', (req, res) => {
    res.send({
        status: 200,
        message: '智慧出行酒店预订平台后端服务已启动!'
    });
});

// 3. 启动服务
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Ready for Member A to connect...`);
});