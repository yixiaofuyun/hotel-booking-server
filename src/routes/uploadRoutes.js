// src/routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 引入我们的保安！只有登录的人才能传图片
const { verifyToken } = require('../middlewares/authMiddleware'); 

// 1. 确定图片存在哪里 (项目根目录下的 uploads 文件夹)
const uploadDir = path.join(__dirname, '../../uploads');

// 如果没这个文件夹，代码会自动帮你建一个
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. 配置 multer 的“存储策略”
const storage = multer.diskStorage({
  // 存在哪个目录
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  // 存下来的文件叫什么名字
  filename: function (req, file, cb) {
    // 为了防止不同用户上传同名文件（比如都叫 1.jpg）发生覆盖
    // 我们给文件名加一个“时间戳 + 随机数”的前缀
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname); // 获取后缀名 (如 .jpg)
    cb(null, uniqueSuffix + ext); 
  }
});

// 初始化 multer
const upload = multer({ storage: storage });

// 3. 定义上传接口 (注意：保安 verifyToken 站在了最前面！)
// upload.single('file') 表示前端传过来的字段名必须叫 'file'
router.post('/', verifyToken, upload.single('file'), (req, res) => {
  try {
    // 如果前端没传文件过来
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择要上传的图片' });
    }

    // 拼接出可以在浏览器里访问的图片 URL
    // req.file.filename 就是刚才 multer 帮我们生成的带时间戳的文件名
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    res.json({
      code: 0,
      message: '图片上传成功',
      data: {
        url: fileUrl // 最终前端需要的就是这串字符串！
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: '上传失败', error: error.message });
  }
});

module.exports = router;