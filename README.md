# 🏨 Hotel Booking System - Backend API (全栈酒店预订平台服务端)

基于 Node.js + Express + MongoDB 构建的企业级 OTA (在线旅游代理) 酒店预订系统后端 API。该项目打通了 B端商户精细化运营与 C端用户便捷找房的业务闭环，包含了极其严谨的动态库存校验与风控机制。

## ✨ 核心硬核亮点 (Core Features)

- 🧠 **智能价格牵引机制 (Smart Price Sync)**
  彻底摒弃传统的手动标价。底层系统在商户对房型进行增、删、改价或上下架操作时，会自动寻轨并重算当前“已过审且可售”的最便宜房型，实时将最低价反向同步为酒店的 C 端展示“起步价”，保证价格绝对真实有效。
- 📅 **OTA 级连贯库存检索引擎 (Continuous Inventory Check)**
  抛弃简单的数量增减，采用真实的“日历库存”模型（自动生成未来 60 天房态）。C 端搜索时，系统会根据用户入住期间的“每一天”进行连贯性库存比对过滤，杜绝断房/超卖现象。
- 🔍 **多维度复合搜索与内存切片分页 (Multi-dimensional Search & Pagination)**
  支持按城市、经纬度商圈、价格区间、容纳人数、星级、设施标签（酒店级 & 房间级）进行复杂精准检索。在核心底层通过内存级切片分页技术，完美解决了因复杂组合过滤导致的数据库传统分页 (`skip/limit`) 错位与空页 Bug。
- 🛡️ **双重权限与状态风控体系 (Role-based Access & Risk Control)**
  严格分离 C端用户与 B端商户权限。商户所有的修改动作均会触发底层的状态重置（打回待审），房型必须同时满足“平台过审 (status: 1)”与“商户上架 (is_published: true)”双重条件才向 C 端暴露。

## 🛠️ 技术栈 (Tech Stack)

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB & Mongoose (NoSQL)
- **Authentication:** JWT (JSON Web Token)
- **Deployment:** Alibaba Cloud, PM2
- **API Testing:** Apifox

## 📂 核心目录结构 (Directory Structure)

```text
hotel-booking-server/
├── src/
│   ├── api/            # (预留) 第三方 API 接入
│   ├── config/         # 数据库与全局配置 (db.js)
│   ├── controllers/    # 核心业务逻辑控制器
│   │   ├── adminController.js   # 管理员审核模块
│   │   ├── authController.js    # 登录/注册模块
│   │   ├── hotelController.js   # 酒店维度管理与 C端高级搜索
│   │   └── roomController.js    # 房型与日历库存管理机制
│   ├── middlewares/    # 全局中间件
│   │   └── authMiddleware.js    # JWT 鉴权与保安拦截
│   ├── models/         # Mongoose 数据模型定义
│   │   ├── Hotel.js
│   │   ├── Room.js
│   │   ├── RoomStock.js # 每日库存模型
│   │   └── User.js
│   ├── routes/         # RESTful 路由映射表
│   └── utils/          # 工具函数库
├── uploads/            # 本地图片上传存储目录
├── app.js              # Express 实例与入口文件
└── package.json
