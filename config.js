// 配置文件
const storedSupabaseUrl = localStorage.getItem('duty_supabase_url') || '';
const storedSupabaseAnonKey = localStorage.getItem('duty_supabase_anon_key') || '';

const CONFIG = {
    // Supabase 配置
    SUPABASE: {
        // GitHub Pages 部署时请填写 Supabase 项目地址，例如：
        // https://xxxx.supabase.co
        URL: "https://xtghbtkmdpcorfjmxgld.supabase.co",
        // Supabase anon key（可公开，勿填 service_role）
        ANON_KEY: "sb_publishable_q9XxE069nPUZfM9hq7TArQ_HW1wd8jw"
    },

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

// 导出配置（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG };
}
