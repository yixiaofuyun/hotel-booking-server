const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // 记得存加密后的密码
  role: { 
    type: String, 
    enum: ['admin', 'merchant', 'customer'], 
    default: 'customer' 
  },
  avatar_url: { type: String, default: '' },

  // --- 商户专属字段 (仅当 role='merchant' 时使用) ---
  merchant_profile: {
    business_name: { type: String }, // 企业名
    license_url: { type: String },   // 营业执照
    contact_phone: { type: String },
    status: { type: Number, default: 0 }, // 0:待审, 1:通过, 2:驳回
    audit_remark: { type: String }        // 审核意见
  },

  // --- C端用户专属字段 (仅当 role='customer' 时使用) ---
  customer_profile: {
    real_name: { type: String },
    phone: { type: String },
    id_card: { type: String },
    membership_level: { type: Number, default: 0 }
  }
}, { timestamps: true }); // 自动管理 createdAt, updatedAt

module.exports = mongoose.model('User', UserSchema);