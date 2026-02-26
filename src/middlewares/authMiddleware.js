// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

// ⚠️ 注意：这里的秘钥必须和你在 authController.js 里生成 Token 时用的一模一样！
const JWT_SECRET = 'yisu_hotel_super_secret_key_2024'; 

const authMiddleware = {
  // 1. 基础保安：校验 Token 是否有效 (所有需要登录的接口都要用)
  verifyToken(req, res, next) {
    try {
      // 从请求头里获取 Authorization 字段
      const authHeader = req.headers.authorization;

      // 规范的 Token 传递方式是: "Bearer eyJhbGci..."
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ code: 401, message: '未经授权：请先登录' });
      }

      // 提取出真正的 token 字符串
      const token = authHeader.split(' ')[1];

      // 校验并解码 Token
      const decoded = jwt.verify(token, JWT_SECRET);

      // 核心动作：把解密出来的用户信息（userId, role）挂载到 req 对象上
      // 这样后面的 Controller 就能直接通过 req.user 知道是谁发起的请求了！
      req.user = decoded; 

      // 检查通过，放行！去执行下一个环节（通常就是 Controller）
      next(); 
    } catch (error) {
      // 如果 Token 过期或者被篡改，jwt.verify 会抛出错误，在这里被捕获
      return res.status(401).json({ code: 401, message: 'Token 无效或已过期，请重新登录' });
    }
  },

  // 2. 高级保安：校验是否是商户 (必须接在 verifyToken 后面使用)
  isMerchant(req, res, next) {
    if (req.user && req.user.role === 'merchant') {
      next(); // 是商户，放行
    } else {
      res.status(403).json({ code: 403, message: '权限不足：只有商户可以执行此操作' });
    }
  },

  // 3. 终极保安：校验是否是管理员
  isAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
      next(); // 是管理员，放行
    } else {
      res.status(403).json({ code: 403, message: '权限不足：只有管理员可以执行此操作' });
    }
  }
};

module.exports = authMiddleware;