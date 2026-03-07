// 配置文件
const CONFIG = {
    // 管理员配置
    ADMIN: {
        // 默认密码，生产环境应该通过环境变量设置
        DEFAULT_PASSWORD: 'admin123',
        // 密码存储键名
        PASSWORD_KEY: 'duty_schedule_admin_password',
        // 会话过期时间（毫秒）
        SESSION_TIMEOUT: 2 * 60 * 60 * 1000, // 2小时
        // 最大登录尝试次数
        MAX_LOGIN_ATTEMPTS: 5,
        // 锁定时间（毫秒）
        LOCKOUT_DURATION: 15 * 60 * 1000 // 15分钟
    },

    // 数据缓存配置
    CACHE: {
        // 数据版本键名
        VERSION_KEY: 'dataCacheVersion',
        // 本地修改键名
        LOCAL_CHANGES_KEY: 'localScheduleChanges',
        // 自动保存间隔（毫秒）
        AUTO_SAVE_INTERVAL: 30 * 1000, // 30秒
        // 最大本地修改记录数
        MAX_LOCAL_CHANGES: 100
    },

    // 界面配置
    UI: {
        // Toast显示时间（毫秒）
        TOAST_DURATION: 3000,
        // 动画持续时间（毫秒）
        ANIMATION_DURATION: 300,
        // 高亮显示时间（毫秒）
        HIGHLIGHT_DURATION: 3000
    },

    // 开发模式配置
    DEVELOPMENT: {
        // 是否启用开发模式
        ENABLED: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
        // 是否显示调试信息
        DEBUG: false
    }
};

// 安全相关的工具函数
const SecurityUtils = {
    // 生成哈希值（简单实现，生产环境建议使用更安全的算法）
    simpleHash: function(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString();
    },

    // 验证密码强度
    validatePasswordStrength: function(password) {
        const minLength = 6;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        const strength = {
            score: 0,
            feedback: []
        };

        if (password.length >= minLength) strength.score++;
        else strength.feedback.push(`密码长度至少${minLength}位`);

        if (hasUpperCase) strength.score++;
        else strength.feedback.push('建议包含大写字母');

        if (hasLowerCase) strength.score++;
        else strength.feedback.push('建议包含小写字母');

        if (hasNumbers) strength.score++;
        else strength.feedback.push('建议包含数字');

        if (hasSpecialChar) strength.score++;
        else strength.feedback.push('建议包含特殊字符');

        return strength;
    },

    // 生成随机密码
    generateRandomPassword: function(length = 12) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    }
};

// 导出配置（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, SecurityUtils };
}