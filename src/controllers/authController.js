// src/controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 随便定一个秘钥，实际开发应该放在 .env 文件里
const JWT_SECRET = 'yisu_hotel_super_secret_key_2024'; 

const authController = {
  // 1. 商户注册
  async registerMerchant(req, res) {
    try {
      const { username, password, business_name, license_url, contact_phone } = req.body;

      // 检查账号是否已存在
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ code: 400, message: '用户名已被注册' });
      }

      // 密码加密
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 创建商户账号
      const newUser = await User.create({
        username,
        password: hashedPassword,
        role: 'merchant',
        merchant_profile: {
          business_name,
          license_url,
          contact_phone,
          status: 0 // 0代表待审核
        }
      });

      res.json({
        code: 0,
        message: '商户注册成功，请等待管理员审核',
        data: {
            userId: newUser._id,
            role: newUser.role,
            status: newUser.merchant_profile.status
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '服务器错误', error: error.message });
    }
  },

  // 2. C端用户注册
  async registerCustomer(req, res) {
    try {
      const { username, password, real_name, phone, id_card } = req.body;

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ code: 400, message: '用户名已被注册' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = await User.create({
        username,
        password: hashedPassword,
        role: 'customer',
        customer_profile: {
          real_name,
          phone,
          id_card
        }
      });

      res.status(201).json({
        code: 0,
        message: '注册成功',
        data: { userId: newUser._id, role: newUser.role }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '服务器错误', error: error.message });
    }
  },

  // 3. 通用登录接口
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // 查找用户
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(400).json({ code: 400, message: '用户不存在或密码错误' });
      }

      // 校验密码
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ code: 400, message: '用户不存在或密码错误' });
      }

      // 生成 Token (包含用户ID和角色)
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' } // Token 7天有效
      );

      // 构造返回给前端的用户信息 (剔除密码)
      const userInfo = {
        userId: user._id,
        username: user.username,
        role: user.role,
        avatar_url: user.avatar_url,
      };

      // 如果是商户，把审核状态也传过去
      if (user.role === 'merchant') {
        userInfo.merchant_status = user.merchant_profile.status;
        userInfo.audit_remark = user.merchant_profile.audit_remark;
      }

      res.json({
        code: 0,
        message: '登录成功',
        data: { token, userInfo }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '服务器错误', error: error.message });
    }
  },
  // 4. 获取当前登录用户信息 (需要 Token 保安放行才能进)
  async getMe(req, res) {
    try {
      // 1. 这里的 req.user 是谁给的？
      // 是我们的保安 (authMiddleware.js) 解密 Token 后挂载上去的！
      // 里面长这样: { userId: '65c3...', role: 'merchant' }
      const userId = req.user.userId;

      // 2. 拿着 ID 去数据库里查这个人
      // .select('-password') 的意思是：把密码字段剔除掉，绝对不能返回给前端！
      const user = await User.findById(userId).select('-password');

      if (!user) {
        return res.status(404).json({ code: 404, message: '找不到该用户' });
      }

      // 3. 组装返回给前端的数据
      const userInfo = {
        userId: user._id,
        username: user.username,
        role: user.role,
        avatar_url: user.avatar_url,
      };

      // 4. 根据角色不同，返回专属的档案信息
      if (user.role === 'merchant') {
        userInfo.merchant_profile = user.merchant_profile;
      } else if (user.role === 'customer') {
        userInfo.customer_profile = user.customer_profile;
      }

      // 5. 成功返回
      res.json({
        code: 0,
        message: '获取个人信息成功',
        data: userInfo
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '服务器错误', error: error.message });
    }
  },
  // 5. 修改个人信息 (需要 Token 保安放行)
  async updateProfile(req, res) {
    try {
      // 从保安那里拿到当前操作人的 ID
      const userId = req.user.userId;
      // 前端传过来的要修改的数据 (比如 { avatar_url: '...', real_name: '李四' })
      const updates = req.body;

      // 查出该用户
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ code: 404, message: '用户不存在' });
      }

      // 1. 通用字段修改 (比如大家都能换头像)
      if (updates.avatar_url) user.avatar_url = updates.avatar_url;

      // 2. 根据角色区分专属字段修改
      if (user.role === 'customer') {
        // C端用户补全信息
        if (updates.real_name) user.customer_profile.real_name = updates.real_name;
        if (updates.id_card) user.customer_profile.id_card = updates.id_card;
        
      } else if (user.role === 'merchant') {
        // 商户修改信息
        if (updates.business_name) user.merchant_profile.business_name = updates.business_name;
        
        // 🌟 核心业务逻辑：如果商户重新上传了营业执照，必须重新打回待审核状态
        if (updates.license_url) {
          user.merchant_profile.license_url = updates.license_url;
          user.merchant_profile.status = 0; // 状态变为 0: 待审核
          user.merchant_profile.audit_remark = ''; // 清空之前的驳回理由
        }
      }

      // 保存修改到数据库
      await user.save();

      res.json({
        code: 0,
        message: '个人信息修改成功',
        data: {
          userId: user._id,
          // 如果是商户，把最新的审核状态返回给前端，方便前端刷新页面
          merchant_status: user.role === 'merchant' ? user.merchant_profile.status : undefined
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: '服务器错误', error: error.message });
    }
  },
  // 6. 提交商户资质认证 (需要 Token 保安放行)
  async submitCertify(req, res) {
    try {
      // 1. 从 Token 中获取 userId
      const userId = req.user.userId;
      
      // 2. 从前端请求体获取表单数据
      const { business_name, contact_phone, license_url } = req.body;

      // 简单的数据校验
      if (!business_name || !contact_phone || !license_url) {
        return res.status(400).json({ code: 400, message: '请完整填写企业名称、电话和营业执照' });
      }

      // 3. 查询用户
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ code: 404, message: '用户不存在' });
      }

      // 安全校验：只有商户角色才能提交
      if (user.role !== 'merchant') {
        return res.status(403).json({ code: 403, message: '非法操作：非商户账号无法提交资质' });
      }

      // 4. 更新商户档案，推进状态机！
      user.merchant_profile.business_name = business_name;
      user.merchant_profile.contact_phone = contact_phone;
      user.merchant_profile.license_url = license_url;
      // 🌟 核心：状态从 0(未提交) 或 3(被驳回) 变更为 1(待审核)
      user.merchant_profile.status = 1; 
      // 提交新资料后，清空历史的驳回理由
      user.merchant_profile.audit_remark = ''; 

      // 5. 保存到数据库
      await user.save();

      // 6. 成功响应
      res.json({
        code: 0,
        message: '资质提交成功，请耐心等待平台审核！',
        data: {
          userId: user._id,
          merchant_status: user.merchant_profile.status // 返回最新状态 1
        }
      });

    } catch (error) {
      res.status(500).json({ code: 500, message: '服务器错误', error: error.message });
    }
  },
};

module.exports = authController;