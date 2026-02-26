// src/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // 这里的地址对应你本地的数据库
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/hotel_booking_db');
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // 如果连不上，直接退出程序
    process.exit(1);
  }
};

module.exports = connectDB;