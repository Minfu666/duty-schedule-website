// script.js
document.addEventListener('DOMContentLoaded', function() {
    // 全局变量
    let scheduleData = {};
    let currentDate = getTodayDateStr();
    let isAdminMode = false;
    let currentSelectedSlot = null;
    let loginAttempts = 0;
    let lockoutUntil = null;
    let changeLogsCache = [];

    const supabaseUrl = String((CONFIG.SUPABASE && CONFIG.SUPABASE.URL) || '')
        .trim()
        .replace(/\/+$/, '');
    const supabaseAnonKey = String((CONFIG.SUPABASE && CONFIG.SUPABASE.ANON_KEY) || '').trim();
    const STORAGE_KEYS = {
        schedule: 'scheduleData',
        changeLogs: 'changeLogs'
    };

    function isSupabaseConfigured() {
        return Boolean(supabaseUrl && supabaseAnonKey);
    }

    function buildSupabaseUrl(resource, params = null) {
        if (!isSupabaseConfigured()) {
            throw new Error('Supabase 未配置');
        }
        const base = `${supabaseUrl}/rest/v1/${resource}`;
        if (!params) {
            return base;
        }
        return `${base}?${params.toString()}`;
    }

    function getSupabaseHeaders(extra = {}) {
        return {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            ...extra
        };
    }

    function scheduleMapToRows(scheduleMap) {
        const rows = [];
        for (const [date, entries] of Object.entries(scheduleMap || {})) {
            (entries || []).forEach(entry => {
                rows.push({
                    date,
                    floor: entry.floor,
                    slot: entry.slot,
                    time: entry.time,
                    name: entry.name
                });
            });
        }
        return rows;
    }

    function scheduleRowsToMap(rows) {
        const out = {};
        (rows || []).forEach(row => {
            if (!out[row.date]) {
                out[row.date] = [];
            }
            out[row.date].push({
                floor: row.floor,
                slot: row.slot,
                time: row.time,
                name: row.name
            });
        });
        return out;
    }

    async function replaceSupabaseSchedule(scheduleMap) {
        const deleteParams = new URLSearchParams();
        deleteParams.set('date', 'not.is.null');
        const deleteResp = await fetch(buildSupabaseUrl('schedule_entries', deleteParams), {
            method: 'DELETE',
            headers: getSupabaseHeaders({ Prefer: 'return=minimal' })
        });
        if (!deleteResp.ok) {
            throw new Error(`清空 schedule_entries 失败: HTTP ${deleteResp.status}`);
        }

        const rows = scheduleMapToRows(scheduleMap);
        if (rows.length === 0) {
            return;
        }

        const insertResp = await fetch(buildSupabaseUrl('schedule_entries'), {
            method: 'POST',
            headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
            body: JSON.stringify(rows)
        });
        if (!insertResp.ok) {
            throw new Error(`写入 schedule_entries 失败: HTTP ${insertResp.status}`);
        }
    }

    function getTodayDateStr() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateToYMD(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getNearestDateBySchedule(data, fallbackDate) {
        const dates = Object.keys(data || {}).sort();
        if (dates.length === 0) {
            return fallbackDate;
        }

        if (data[fallbackDate]) {
            return fallbackDate;
        }

        const targetTime = new Date(fallbackDate).getTime();
        let nearestDate = dates[0];
        let nearestDiff = Math.abs(new Date(dates[0]).getTime() - targetTime);

        dates.forEach(date => {
            const diff = Math.abs(new Date(date).getTime() - targetTime);
            if (diff < nearestDiff) {
                nearestDiff = diff;
                nearestDate = date;
            }
        });

        return nearestDate;
    }

    // 从配置获取管理员密码
    const getAdminPassword = function() {
        // 首先检查环境变量（仅在支持的浏览器中）
        if (typeof process !== 'undefined' && process.env.ADMIN_PASSWORD) {
            return process.env.ADMIN_PASSWORD;
        }

        // 检查本地存储的自定义密码
        const customPassword = localStorage.getItem(CONFIG.ADMIN.PASSWORD_KEY);
        if (customPassword) {
            return customPassword;
        }

        // 使用默认密码
        return CONFIG.ADMIN.DEFAULT_PASSWORD;
    };

    // 保存排班数据到 Supabase
    async function saveScheduleData() {
        const normalized = processScheduleData(scheduleData);
        if (isSupabaseConfigured()) {
            try {
                await replaceSupabaseSchedule(normalized);
            } catch (error) {
                console.warn('Supabase 保存失败，降级为本地保存:', error);
                showToast('Supabase 不可用，已切换为本地保存模式', 'warning');
            }
        }

        localStorage.setItem(STORAGE_KEYS.schedule, JSON.stringify(normalized));
        scheduleData = normalized;
    }

    // 初始化应用
    async function initApp() {
        showLoading();
        try {
            if (window.location.hostname.endsWith('github.io') && !isSupabaseConfigured()) {
                console.warn('GitHub Pages 场景未配置 Supabase URL / ANON_KEY。');
            }
            await loadScheduleData();
            setupEventListeners();
            loadDateData(currentDate);
            updateDateDisplay(currentDate);
            hideLoading();
        } catch (error) {
            console.error('初始化失败:', error);
            hideLoading();
            alert('应用初始化失败，请刷新页面重试');
        }
    }

    async function loadFromSupabase() {
        if (!isSupabaseConfigured()) {
            throw new Error('Supabase 未配置');
        }

        const params = new URLSearchParams();
        params.set('select', 'date,floor,slot,time,name');
        params.set('order', 'date.asc,floor.asc,slot.asc');
        const response = await fetch(buildSupabaseUrl('schedule_entries', params), {
            method: 'GET',
            headers: getSupabaseHeaders()
        });
        if (!response.ok) {
            throw new Error(`Supabase 读取失败: HTTP ${response.status}`);
        }
        const rows = await response.json();
        return scheduleRowsToMap(rows);
    }

    function loadFromLocalStorage() {
        const raw = localStorage.getItem(STORAGE_KEYS.schedule);
        if (!raw) {
            throw new Error('本地缓存数据不存在');
        }
        return JSON.parse(raw);
    }

    // 加载排班数据（Supabase -> localStorage）
    async function loadScheduleData() {
        let data = null;
        try {
            data = await loadFromSupabase();
        } catch (supabaseError) {
            console.warn('Supabase 加载失败，尝试本地缓存:', supabaseError);
        }

        if (!data) {
            try {
                data = loadFromLocalStorage();
                console.log('已从本地缓存加载数据');
            } catch (localError) {
                console.error('本地缓存加载失败:', localError);
            }
        }

        if (!data) {
            scheduleData = {};
            currentDate = getTodayDateStr();
            console.warn('Supabase 和本地缓存均不可用，进入空数据模式');
            showToast('暂无排班数据，请先配置 Supabase 或上传当月文件', 'warning');
            return;
        }

        try {
            scheduleData = processScheduleData(data);
            currentDate = getNearestDateBySchedule(scheduleData, currentDate);
            console.log('数据加载成功', scheduleData);
        } catch (error) {
            console.error('加载数据失败:', error);
            showToast('数据加载失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 验证输入数据
    function validateSwapInput(sourceSlot, targetDate, targetFloor, targetSlot) {
        const errors = [];

        // 验证源数据
        if (!sourceSlot || !sourceSlot.date || !sourceSlot.floor || !sourceSlot.slot) {
            errors.push('源数据无效');
        }

        // 验证目标日期
        if (!targetDate) {
            errors.push('请选择目标日期');
        } else {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(targetDate)) {
                errors.push('目标日期格式无效');
            } else {
                const targetDateObj = new Date(targetDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (targetDateObj < today) {
                    errors.push('目标日期不能早于今天');
                }
            }
        }

        // 验证目标楼层
        const validFloors = ['二层', '三层', '四层'];
        if (!targetFloor || !validFloors.includes(targetFloor)) {
            errors.push('请选择有效的目标楼层');
        }

        // 验证目标时段
        if (!targetSlot || ![1, 2].includes(parseInt(targetSlot))) {
            errors.push('请选择有效的目标时段');
        }

        return errors;
    }

    // 验证人员姓名
    function validatePersonName(name) {
        if (!name || typeof name !== 'string') {
            return false;
        }

        // 允许中文姓名、英文名以及一些特殊标记
        const validNamePattern = /^[\u4e00-\u9fa5a-zA-Z\s\-_]+$/;

        // 检查是否为特殊标记（如"空"、"国庆节闭馆"等）
        const specialMarkers = ['空', '国庆节闭馆', '中秋节闭馆', '暂无'];
        if (specialMarkers.includes(name.trim())) {
            return true;
        }

        // 检查姓名长度
        if (name.length < 2 || name.length > 10) {
            return false;
        }

        return validNamePattern.test(name.trim());
    }

    // 验证时间段格式
    function validateTimeFormat(time) {
        if (!time || typeof time !== 'string') {
            return false;
        }

        // 允许的时间格式
        const timePatterns = [
            /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/,  // 09:00-11:00
            /^\d{1,2}:\d{2}$/,                 // 09:00
            /^\d{1,2}:\d{2}-\d{1,2}:\d{2}\s*[\u4e00-\u9fa5]+$/ // 16:30-18:00 附加中文
        ];

        return timePatterns.some(pattern => pattern.test(time.trim()));
    }

    // 验证值班数据完整性
    function validateScheduleData(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            errors.push('数据格式无效');
            return errors;
        }

        for (const [date, entries] of Object.entries(data)) {
            // 验证日期格式
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                errors.push(`日期格式无效: ${date}`);
                continue;
            }

            if (!Array.isArray(entries)) {
                errors.push(`日期 ${date} 的数据不是数组格式`);
                continue;
            }

            // 验证每个条目
            entries.forEach((entry, index) => {
                if (!entry || typeof entry !== 'object') {
                    errors.push(`日期 ${date} 第${index + 1}条数据格式无效`);
                    return;
                }

                // 验证必需字段
                if (!entry.floor || !['二层', '三层', '四层'].includes(entry.floor)) {
                    errors.push(`日期 ${date} 第${index + 1}条楼层信息无效`);
                }

                if (!entry.time || !validateTimeFormat(entry.time)) {
                    errors.push(`日期 ${date} 第${index + 1}条时间格式无效: ${entry.time}`);
                }

                if (!validatePersonName(entry.name)) {
                    errors.push(`日期 ${date} 第${index + 1}条人员姓名无效: ${entry.name}`);
                }

                if (entry.slot !== undefined && ![1, 2].includes(parseInt(entry.slot))) {
                    errors.push(`日期 ${date} 第${index + 1}条时段信息无效`);
                }
            });
        }

        return errors;
    }

    // 校验交换改动数据
    function saveLocalChanges(date, floor, slot, changes) {
        try {
            if (!date || !floor || slot === undefined || !changes) {
                throw new Error('保存参数无效');
            }

            if (changes.name && !validatePersonName(changes.name)) {
                throw new Error('人员姓名格式无效');
            }

            if (changes.time && !validateTimeFormat(changes.time)) {
                throw new Error('时间格式无效');
            }
        } catch (error) {
            console.error('修改数据校验失败:', error);
            showToast('保存修改失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 更新数据缓存版本
    function updateDataCacheVersion() {
        const currentVersion = Date.now().toString();
        localStorage.setItem('dataCacheVersion', currentVersion);
    }

    function inferSlotFromTime(time) {
        const normalized = String(time || '').replace(/\s+/g, '');
        if (!normalized) return 1;
        if (normalized.includes('19:00-21:00') || normalized.includes('19:00')) return 2;
        return 1;
    }

    // 处理数据格式，统一排序与slot
    function processScheduleData(data) {
        const processedData = {};

        if (!data || typeof data !== 'object') {
            return processedData;
        }

        const floorOrder = { '二层': 1, '三层': 2, '四层': 3 };

        for (const [date, entries] of Object.entries(data)) {
            if (!Array.isArray(entries)) {
                processedData[date] = [];
                continue;
            }

            const normalizedEntries = entries
                .filter(item => item && typeof item === 'object' && floorOrder[item.floor])
                .map(item => {
                    const parsedSlot = parseInt(item.slot, 10);
                    return {
                        ...item,
                        time: String(item.time || '暂无').trim(),
                        name: String(item.name || '暂无').trim(),
                        slot: [1, 2].includes(parsedSlot) ? parsedSlot : inferSlotFromTime(item.time)
                    };
                })
                .sort((a, b) => {
                    const floorDiff = floorOrder[a.floor] - floorOrder[b.floor];
                    if (floorDiff !== 0) return floorDiff;

                    const slotDiff = a.slot - b.slot;
                    if (slotDiff !== 0) return slotDiff;

                    const timeDiff = a.time.localeCompare(b.time, 'zh-CN');
                    if (timeDiff !== 0) return timeDiff;

                    return a.name.localeCompare(b.name, 'zh-CN');
                });

            processedData[date] = normalizedEntries;
        }

        return Object.fromEntries(
            Object.entries(processedData).sort((a, b) => a[0].localeCompare(b[0]))
        );
    }

    // 设置事件监听器
    function setupEventListeners() {
        setupAdminFeatures();
        setupDateNavigation();
        setupCalendarModal();
        setupSwapModal();
        setupChangeLog();
    }

    // 管理员功能设置
    function setupAdminFeatures() {
        const adminBtn = document.getElementById('admin-mode');
        const adminModal = document.getElementById('admin-modal');
        const closeBtns = document.querySelectorAll('.close');
        const modalOverlays = document.querySelectorAll('.modal-overlay');

        // 管理员模式切换
        adminBtn.addEventListener('click', function() {
            if (!isAdminMode) {
                adminModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            } else {
                logoutAdmin();
            }
        });

        // 管理员登录
        document.getElementById('login-btn').addEventListener('click', handleAdminLogin);

        // 密码输入框回车登录
        document.getElementById('admin-password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleAdminLogin();
            }
        });

        // 关闭按钮
        closeBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                modal.style.display = 'none';
                document.body.style.overflow = '';
            });
        });

        // 模态框外部点击关闭
        modalOverlays.forEach(overlay => {
            overlay.addEventListener('click', function() {
                const modal = this.closest('.modal');
                modal.style.display = 'none';
                document.body.style.overflow = '';
            });
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => {
                    if (modal.style.display === 'block') {
                        modal.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                });
            }
        });
    }

    // 检查是否被锁定
    function isLockedOut() {
        if (lockoutUntil && new Date() < lockoutUntil) {
            const remainingTime = Math.ceil((lockoutUntil - new Date()) / 1000 / 60);
            showToast(`账户已锁定，请${remainingTime}分钟后再试`, 'error');
            return true;
        }
        return false;
    }

    // 处理登录失败
    function handleLoginFailure() {
        loginAttempts++;

        if (loginAttempts >= CONFIG.ADMIN.MAX_LOGIN_ATTEMPTS) {
            lockoutUntil = new Date(Date.now() + CONFIG.ADMIN.LOCKOUT_DURATION);
            showToast(`登录失败次数过多，账户已锁定${CONFIG.ADMIN.LOCKOUT_DURATION / 60000}分钟`, 'error');

            // 禁用登录按钮
            document.getElementById('login-btn').disabled = true;
            document.getElementById('admin-password').disabled = true;

            // 设置定时器解锁
            setTimeout(() => {
                lockoutUntil = null;
                loginAttempts = 0;
                document.getElementById('login-btn').disabled = false;
                document.getElementById('admin-password').disabled = false;
                showToast('账户已解锁，可以重新登录', 'success');
            }, CONFIG.ADMIN.LOCKOUT_DURATION);
        } else {
            const remainingAttempts = CONFIG.ADMIN.MAX_LOGIN_ATTEMPTS - loginAttempts;
            showToast(`密码错误，还有${remainingAttempts}次尝试机会`, 'error');
        }
    }

    // 处理管理员登录
    function handleAdminLogin() {
        // 检查是否被锁定
        if (isLockedOut()) {
            return;
        }

        const password = document.getElementById('admin-password').value;
        const adminPassword = getAdminPassword();

        if (!password) {
            showToast('请输入密码', 'error');
            return;
        }

        if (password === adminPassword) {
            // 登录成功，重置计数器
            loginAttempts = 0;
            lockoutUntil = null;

            isAdminMode = true;
            document.getElementById('admin-mode').textContent = '退出管理员';
            document.getElementById('admin-mode').classList.add('active');
            document.body.classList.add('admin-mode');

            // 显示更换日志按钮
            document.getElementById('change-log-btn').style.display = 'inline-block';

            document.getElementById('admin-modal').style.display = 'none';
            document.body.style.overflow = '';

            document.getElementById('admin-password').value = '';

            // 设置会话过期时间
            setTimeout(() => {
                if (isAdminMode) {
                    logoutAdmin();
                    showToast('管理员会话已过期，请重新登录', 'warning');
                }
            }, CONFIG.ADMIN.SESSION_TIMEOUT);

            showToast('管理员模式已启用', 'success');
        } else {
            handleLoginFailure();
        }
    }

    // 退出管理员模式
    function logoutAdmin() {
        isAdminMode = false;
        document.getElementById('admin-mode').textContent = '管理员模式';
        document.getElementById('admin-mode').classList.remove('active');
        document.body.classList.remove('admin-mode');

        // 隐藏更换日志按钮
        document.getElementById('change-log-btn').style.display = 'none';

        showToast('已退出管理员模式');
    }

    // 日期导航设置
    function setupDateNavigation() {
        const prevBtn = document.getElementById('prev-day');
        const todayBtn = document.getElementById('today');
        const nextBtn = document.getElementById('next-day');

        prevBtn.addEventListener('click', () => navigateDate(-1));
        todayBtn.addEventListener('click', () => navigateDate(0));
        nextBtn.addEventListener('click', () => navigateDate(1));

        // 键盘导航
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey || e.metaKey) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    navigateDate(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    navigateDate(1);
                    break;
                case 't':
                case 'T':
                    e.preventDefault();
                    navigateDate(0);
                    break;
            }
        });
    }

    function navigateDate(days) {
        const date = new Date(currentDate);
        
        if (days === 0) {
            date.setTime(new Date().getTime());
        } else {
            date.setDate(date.getDate() + days);
        }
        
        currentDate = formatDateToYMD(date);
        loadDateData(currentDate);
        updateDateDisplay(currentDate);
    }

    // 日历模态框设置
    function setupCalendarModal() {
        const calendarBtn = document.getElementById('calendar-btn');
        const calendarModal = document.getElementById('calendar-modal');
        const calendarGrid = document.getElementById('calendar-grid');
        const currentMonthDisplay = document.getElementById('current-month-display');
        const prevMonthBtn = document.getElementById('prev-month');
        const nextMonthBtn = document.getElementById('next-month');

        let currentCalendarDate = new Date(); // 用于日历导航的日期对象

        calendarBtn.addEventListener('click', function() {
            renderCalendar(currentCalendarDate);
            calendarModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });

        prevMonthBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar(currentCalendarDate);
        });

        nextMonthBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar(currentCalendarDate);
        });

        calendarGrid.addEventListener('click', function(event) {
            if (event.target.classList.contains('calendar-day') && !event.target.classList.contains('empty')) {
                const selectedDate = event.target.dataset.date;
                currentDate = selectedDate;
                updateDateDisplay(currentDate);
                loadDateData(currentDate);
                calendarModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });

        function renderCalendar(date) {
            currentMonthDisplay.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月`;
            calendarGrid.innerHTML = '';

            const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const daysInMonth = lastDayOfMonth.getDate();
            const startDay = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday

            // 填充空白日期
            for (let i = 0; i < startDay; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.classList.add('calendar-day', 'empty');
                calendarGrid.appendChild(emptyDay);
            }

            // 填充日期
            for (let i = 1; i <= daysInMonth; i++) {
                const day = document.createElement('div');
                day.classList.add('calendar-day');
                const fullDate = new Date(date.getFullYear(), date.getMonth(), i);
                const formattedDate = formatDateToYMD(fullDate);
                day.dataset.date = formattedDate;
                day.textContent = i;

                // 标记有数据的日期
                if (scheduleData[formattedDate] && scheduleData[formattedDate].length > 0) {
                    day.classList.add('has-schedule');
                }

                // 标记当前日期
                if (formattedDate === currentDate) {
                    day.classList.add('current-day');
                }

                calendarGrid.appendChild(day);
            }
        }
    }

    // 交换模态框设置
    function setupSwapModal() {
        const swapModal = document.getElementById('swap-modal');
        const confirmSwapBtn = document.getElementById('confirm-swap');
        const cancelSwapBtn = document.getElementById('cancel-swap');

        document.getElementById('blocks-container').addEventListener('click', function(event) {
            if (event.target.classList.contains('swap-btn')) {
                if (!isAdminMode) {
                    showToast('请先登录管理员模式才能进行交换操作。', 'warning');
                    return;
                }
                const parentTimeBlock = event.target.closest('.time-block');
                currentSelectedSlot = {
                    date: currentDate,
                    floor: parentTimeBlock.dataset.floor,
                    slot: parseInt(parentTimeBlock.dataset.slot),
                    time: parentTimeBlock.querySelector('.time').textContent,
                    name: parentTimeBlock.querySelector('.name').textContent
                };
                
                document.getElementById('selected-floor').textContent = currentSelectedSlot.floor;
                document.getElementById('selected-time').textContent = currentSelectedSlot.time;
                document.getElementById('selected-name').textContent = currentSelectedSlot.name;
                
                // 默认目标日期为当前日期
                document.getElementById('target-date').value = currentDate;

                swapModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        });

        confirmSwapBtn.addEventListener('click', handleSwapConfirmation);

        // 处理交换确认
        async function handleSwapConfirmation() {
            if (!currentSelectedSlot) {
                showToast('没有选择要交换的值班信息。', 'error');
                return;
            }

            const targetDate = document.getElementById('target-date').value;
            const targetFloor = document.getElementById('target-floor').value;
            const targetSlot = parseInt(document.getElementById('target-slot').value);

            // 验证输入
            const validationErrors = validateSwapInput(currentSelectedSlot, targetDate, targetFloor, targetSlot);
            if (validationErrors.length > 0) {
                showToast('输入验证失败: ' + validationErrors.join(', '), 'error');
                return;
            }

            // 防止自己和自己交换
            if (currentSelectedSlot.date === targetDate &&
                currentSelectedSlot.floor === targetFloor &&
                currentSelectedSlot.slot === targetSlot) {
                showToast('不能选择相同的时段进行交换', 'error');
                return;
            }

            try {
                // 调用实际的交换逻辑
                await handleSwap(currentSelectedSlot, targetDate, targetFloor, targetSlot);
            } catch (error) {
                console.error('交换操作失败:', error);
                showToast('值班信息交换失败: ' + error.message, 'error');
            } finally {
                swapModal.style.display = 'none';
                document.body.style.overflow = '';
                currentSelectedSlot = null;
                // 重新加载当前日期的排班数据以更新显示
                loadDateData(currentDate);
            }
        }
        cancelSwapBtn.addEventListener('click', () => {
            swapModal.style.display = 'none';
            document.body.style.overflow = '';
            currentSelectedSlot = null;
        });

        // 今天日期作为默认目标日期
        const todayInput = document.getElementById('target-date');
        todayInput.value = getTodayDateStr();
    }

    // 显示交换模态框
    function showSwapModal() {
        const modal = document.getElementById('swap-modal');
        const selectedInfo = document.querySelector('.selected-slot');
        
        selectedInfo.innerHTML = `
            <strong>当前选择：</strong>
            ${currentSelectedSlot.floor} - 
            ${currentSelectedSlot.time} - 
            ${currentSelectedSlot.name}
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    // 处理交换
    async function handleSwap(sourceSlot, targetDate, targetFloor, targetSlot) {

        const sourceDate = sourceSlot.date;
        const sourceFloor = sourceSlot.floor;
        const sourceSlotNum = sourceSlot.slot;

        if (!scheduleData[targetDate]) {
            scheduleData[targetDate] = [];
        }

        let sourceEntry = scheduleData[sourceDate].find(item =>
            item.floor === sourceFloor && item.slot === sourceSlotNum
        );
        let targetEntry = scheduleData[targetDate].find(item =>
            item.floor === targetFloor && item.slot === targetSlot
        );

        if (!sourceEntry) {
            throw new Error('未找到源值班信息');
        }

        const operationType = targetEntry ? 'swap' : 'move';

        if (targetEntry) {
            const tempTime = sourceEntry.time;
            const tempName = sourceEntry.name;

            const sourceBefore = {
                date: sourceDate,
                floor: sourceFloor,
                time: sourceEntry.time,
                name: sourceEntry.name,
                slot: sourceSlotNum
            };
            const targetBefore = {
                date: targetDate,
                floor: targetFloor,
                time: targetEntry.time,
                name: targetEntry.name,
                slot: targetSlot
            };

            sourceEntry.time = targetEntry.time;
            sourceEntry.name = targetEntry.name;
            targetEntry.time = tempTime;
            targetEntry.name = tempName;

            const sourceAfter = {
                date: sourceDate,
                floor: sourceFloor,
                time: sourceEntry.time,
                name: sourceEntry.name,
                slot: sourceSlotNum
            };
            const targetAfter = {
                date: targetDate,
                floor: targetFloor,
                time: targetEntry.time,
                name: targetEntry.name,
                slot: targetSlot
            };

            saveLocalChanges(sourceDate, sourceFloor, sourceSlotNum, {
                time: sourceEntry.time,
                name: sourceEntry.name
            });
            saveLocalChanges(targetDate, targetFloor, targetSlot, {
                time: targetEntry.time,
                name: targetEntry.name
            });

            await recordChangeLog('swap', sourceBefore, sourceAfter);
            if (sourceDate !== targetDate || sourceFloor !== targetFloor || sourceSlotNum !== targetSlot) {
                await recordChangeLog('swap', targetBefore, targetAfter);
            }
        } else {
            const sourceBefore = {
                date: sourceDate,
                floor: sourceFloor,
                time: sourceEntry.time,
                name: sourceEntry.name,
                slot: sourceSlotNum
            };

            const movedTime = sourceEntry.time;
            const movedName = sourceEntry.name;

            const newTargetEntry = {
                floor: targetFloor,
                time: movedTime,
                name: movedName,
                slot: targetSlot
            };
            scheduleData[targetDate].push(newTargetEntry);

            const sourceAfter = {
                date: sourceDate,
                floor: sourceFloor,
                time: '暂无',
                name: '暂无',
                slot: sourceSlotNum
            };
            const targetAfter = {
                date: targetDate,
                floor: targetFloor,
                time: movedTime,
                name: movedName,
                slot: targetSlot
            };

            saveLocalChanges(sourceDate, sourceFloor, sourceSlotNum, {
                time: '暂无',
                name: '暂无'
            });
            saveLocalChanges(targetDate, targetFloor, targetSlot, {
                time: movedTime,
                name: movedName
            });

            sourceEntry.time = '暂无';
            sourceEntry.name = '暂无';

            await recordChangeLog('move', sourceBefore, sourceAfter);
            await recordChangeLog('move', sourceBefore, targetAfter);
        }

        scheduleData = processScheduleData(scheduleData);
        await saveScheduleData();

        updateDateDisplay(currentDate);
        loadDateData(sourceDate);
        if (sourceDate !== targetDate) {
            loadDateData(targetDate);
        }

        if (operationType === 'swap') {
            highlightSwappedBlock(sourceFloor, sourceSlotNum);
            highlightSwappedBlock(targetFloor, targetSlot);
            showToast('值班信息已交换！', 'success');
        } else {
            highlightSwappedBlock(targetFloor, targetSlot);
            showToast('值班信息已移动！', 'success');
        }

        document.getElementById('swap-modal').style.display = 'none';
        document.body.style.overflow = '';
        currentSelectedSlot = null;
    }

    // 加载指定日期的数据并更新UI
    function loadDateData(date) {
        const todaySchedule = scheduleData[date];
        renderSchedule(todaySchedule);
        updateSwapButtonVisibility();
    }

    // 渲染值班表
    function renderSchedule(schedule) {
        const blocksContainer = document.getElementById('blocks-container');
        blocksContainer.innerHTML = ''; // 清空现有内容

        if (!schedule || schedule.length === 0) {
            blocksContainer.innerHTML = '<p class="no-schedule">今日暂无值班安排。</p>';
            return;
        }

        const floors = ['二层', '三层', '四层'];
        floors.forEach(floor => {
            const floorBlock = document.createElement('div');
            floorBlock.classList.add('floor-block');
            floorBlock.dataset.floor = floor;

            const floorHeader = document.createElement('div');
            floorHeader.classList.add('floor-header');
            floorHeader.innerHTML = `
                <span class="floor-icon">🏢</span>
                <h4 class="floor-title">${floor}</h4>
            `;
            floorBlock.appendChild(floorHeader);

            const floorSchedule = schedule.filter(item => item.floor === floor);
            
            // 确保每个楼层有两个时段，即使数据中没有也要显示为空
            const slot1 = floorSchedule.find(item => item.slot === 1) || {time: '', name: ''};
            const slot2 = floorSchedule.find(item => item.slot === 2) || {time: '', name: ''};

            // 时段1
            const timeBlock1 = document.createElement('div');
            timeBlock1.classList.add('time-block');
            timeBlock1.dataset.slot = 1;
            timeBlock1.dataset.floor = floor;
            timeBlock1.innerHTML = `
                <div class="time-info">
                    <span class="time">${slot1.time || '暂无'}</span>
                    <span class="name">${slot1.name || '暂无'}</span>
                </div>
                <button class="swap-btn" data-floor="${floor}" data-slot="1">交换</button>
            `;
            floorBlock.appendChild(timeBlock1);

            // 时段2
            const timeBlock2 = document.createElement('div');
            timeBlock2.classList.add('time-block');
            timeBlock2.dataset.slot = 2;
            timeBlock2.dataset.floor = floor;
            timeBlock2.innerHTML = `
                <div class="time-info">
                    <span class="time">${slot2.time || '暂无'}</span>
                    <span class="name">${slot2.name || '暂无'}</span>
                </div>
                <button class="swap-btn" data-floor="${floor}" data-slot="2">交换</button>
            `;
            floorBlock.appendChild(timeBlock2);

            blocksContainer.appendChild(floorBlock);
        });
    }

    // 更新交换按钮可见性
    function updateSwapButtonVisibility() {
        document.querySelectorAll('.swap-btn').forEach(btn => {
            if (isAdminMode) {
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        });
    }

    // 突出显示交换的方块
    function highlightSwappedBlock(floor, slot) {
        const block = document.querySelector(`.floor-block[data-floor="${floor}"] .time-block[data-slot="${slot}"]`);
        if (block) {
            block.classList.add('swapped');
            setTimeout(() => {
                block.classList.remove('swapped');
            }, 3000); // 3秒后移除高亮
        }
    }



    // 更新日期显示
    function updateDateDisplay(date) {
        const dateElement = document.getElementById('current-date');
        dateElement.textContent = formatDisplayDate(date);
    }

    function formatDisplayDate(dateString) {
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            weekday: 'long' 
        };
        return date.toLocaleDateString('zh-CN', options);
    }

    // 显示加载指示器
    function showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    function hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    // 显示提示信息
    function showToast(message, type = 'success') {
        const oldToast = document.querySelector('.toast');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 添加Toast样式
    const toastStyles = `
        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
        }
        .toast.show {
            transform: translateX(0);
        }
        .toast-success {
            background-color: var(--success-green);
        }
        .toast-error {
            background-color: var(--error-red);
        }
        .calendar-day {
            padding: 10px;
            border: 1px solid #ddd;
            cursor: pointer;
            text-align: center;
        }
        .calendar-day.today {
            background-color: var(--primary-blue);
            color: white;
        }
        .calendar-day.current {
            border: 2px solid var(--orange);
        }
        .calendar-day.has-data {
            background-color: var(--light-blue);
        }
        .calendar-grid-header {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            font-weight: bold;
            text-align: center;
        }
        .calendar-days {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 2px;
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = toastStyles;
    document.head.appendChild(styleSheet);

    // 更换日志功能
    function setupChangeLog() {
        const changeLogBtn = document.getElementById('change-log-btn');
        const changeLogModal = document.getElementById('change-log-modal');
        const closeBtns = document.querySelectorAll('.close');
        const modalOverlays = document.querySelectorAll('.modal-overlay');

        // 打开更换日志
        changeLogBtn.addEventListener('click', async function() {
            await loadChangeLog();
            changeLogModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });

        // 关闭模态框
        closeBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                modal.style.display = 'none';
                document.body.style.overflow = '';
            });
        });

        modalOverlays.forEach(overlay => {
            overlay.addEventListener('click', function() {
                const modal = this.closest('.modal');
                modal.style.display = 'none';
                document.body.style.overflow = '';
            });
        });

        // 日期筛选
        document.getElementById('log-date-filter').addEventListener('change', filterChangeLog);
        document.getElementById('clear-date-filter').addEventListener('click', clearDateFilter);

        // 导出日志
        document.getElementById('export-log').addEventListener('click', exportChangeLog);

        // 清空所有日志
        document.getElementById('clear-all-log').addEventListener('click', clearAllChangeLog);
    }

    // 记录更换日志（写入 Supabase）
    async function recordChangeLog(type, sourceData, targetData) {
        const changeLog = {
            type: type, // 'swap', 'move', 'edit'
            timestamp: new Date().toISOString(),
            source: sourceData,
            target: targetData
        };

        if (isSupabaseConfigured()) {
            try {
                const response = await fetch(buildSupabaseUrl('change_logs'), {
                    method: 'POST',
                    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
                    body: JSON.stringify([changeLog])
                });

                if (!response.ok) {
                    throw new Error(`Supabase 记录更换日志失败: HTTP ${response.status}`);
                }

                if (CONFIG.DEVELOPMENT.DEBUG) {
                    console.log('记录更换日志(Supabase):', changeLog);
                }
                return;
            } catch (error) {
                console.warn('Supabase 日志写入失败，降级本地日志:', error);
            }
        }

        changeLogsCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.changeLogs) || '[]');
        changeLogsCache.unshift(changeLog);
        if (changeLogsCache.length > 100) {
            changeLogsCache = changeLogsCache.slice(0, 100);
        }
        localStorage.setItem(STORAGE_KEYS.changeLogs, JSON.stringify(changeLogsCache));

        if (CONFIG.DEVELOPMENT.DEBUG) {
            console.log('记录更换日志(本地):', changeLog);
        }
    }

    // 加载更换日志
    async function loadChangeLog() {
        if (!isSupabaseConfigured()) {
            changeLogsCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.changeLogs) || '[]');
            displayChangeLog(changeLogsCache);
            updateLogSummary(changeLogsCache);
            return;
        }

        try {
            const params = new URLSearchParams();
            params.set('select', 'id,type,timestamp,source,target');
            params.set('order', 'timestamp.desc');

            const response = await fetch(buildSupabaseUrl('change_logs', params), {
                method: 'GET',
                headers: getSupabaseHeaders()
            });
            if (!response.ok) {
                throw new Error(`Supabase 日志读取失败: HTTP ${response.status}`);
            }

            const payload = await response.json();
            changeLogsCache = Array.isArray(payload) ? payload : [];
            displayChangeLog(changeLogsCache);
            updateLogSummary(changeLogsCache);
        } catch (error) {
            console.error('加载更换日志失败:', error);
            changeLogsCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.changeLogs) || '[]');
            showToast('Supabase 日志加载失败，已切换本地日志', 'warning');
            displayChangeLog(changeLogsCache);
            updateLogSummary(changeLogsCache);
        }
    }

    // 显示更换日志
    function displayChangeLog(changeLogs) {
        const container = document.getElementById('change-log-container');
        const dateFilter = document.getElementById('log-date-filter').value;

        // 应用日期筛选
        let filteredLogs = changeLogs;
        if (dateFilter) {
            filteredLogs = changeLogs.filter(log => {
                const logDate = formatDateToYMD(new Date(log.timestamp));
                return logDate === dateFilter;
            });
        }

        if (filteredLogs.length === 0) {
            container.innerHTML = '<div class="log-empty-message">暂无更换记录</div>';
            return;
        }

        container.innerHTML = filteredLogs.map(log => createLogEntry(log)).join('');
    }

    // 创建日志条目HTML
    function createLogEntry(log) {
        const date = new Date(log.timestamp);
        const formattedTime = formatDateTime(date);

        const typeLabel = {
            'swap': '交换',
            'move': '移动',
            'edit': '编辑'
        }[log.type] || log.type;

        return `
            <div class="log-entry">
                <div class="log-header">
                    <span class="log-time">${formattedTime}</span>
                    <span class="log-type ${log.type}">${typeLabel}</span>
                </div>
                <div class="log-details">
                    <div class="log-source">
                        <div class="log-detail-label">原值班</div>
                        <div class="log-detail-content">
                            <div class="log-detail-name">${log.source.name}</div>
                            <div>${log.source.floor} - ${log.source.time}</div>
                            <div>${log.source.date}</div>
                        </div>
                    </div>
                    <div class="log-target">
                        <div class="log-detail-label">新值班</div>
                        <div class="log-detail-content">
                            <div class="log-detail-name">${log.target.name}</div>
                            <div>${log.target.floor} - ${log.target.time}</div>
                            <div>${log.target.date}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 格式化日期时间
    function formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    // 更新日志统计
    function updateLogSummary(changeLogs) {
        const totalChanges = changeLogs.length;
        const involvedPeople = new Set();

        changeLogs.forEach(log => {
            involvedPeople.add(log.source.name);
            involvedPeople.add(log.target.name);
        });

        const lastChangeTime = changeLogs.length > 0
            ? formatDateTime(new Date(changeLogs[0].timestamp))
            : '无';

        document.getElementById('total-changes').textContent = totalChanges;
        document.getElementById('involved-people').textContent = involvedPeople.size;
        document.getElementById('last-change-time').textContent = lastChangeTime;
    }

    // 筛选更换日志
    function filterChangeLog() {
        displayChangeLog(changeLogsCache);
    }

    // 清除日期筛选
    function clearDateFilter() {
        document.getElementById('log-date-filter').value = '';
        filterChangeLog();
    }

    // 导出更换日志
    function exportChangeLog() {
        const changeLogs = changeLogsCache;

        if (changeLogs.length === 0) {
            showToast('没有可导出的日志记录', 'warning');
            return;
        }

        // 创建CSV内容
        let csvContent = '时间,类型,原日期,原楼层,原时间,原人员,新日期,新楼层,新时间,新人员\n';

        changeLogs.forEach(log => {
            const date = formatDateTime(new Date(log.timestamp));
            const typeLabel = {
                'swap': '交换',
                'move': '移动',
                'edit': '编辑'
            }[log.type] || log.type;

            csvContent += [
                date,
                typeLabel,
                log.source.date,
                log.source.floor,
                log.source.time,
                log.source.name,
                log.target.date,
                log.target.floor,
                log.target.time,
                log.target.name
            ].join(',') + '\n';
        });

        // 创建并下载文件
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `值班更换日志_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('日志导出成功', 'success');
    }

    // 清空所有更换日志
    async function clearAllChangeLog() {
        if (!confirm('确定要清空所有更换日志吗？此操作不可恢复。')) {
            return;
        }

        try {
            if (isSupabaseConfigured()) {
                const params = new URLSearchParams();
                params.set('id', 'gt.0');
                const response = await fetch(buildSupabaseUrl('change_logs', params), {
                    method: 'DELETE',
                    headers: getSupabaseHeaders({ Prefer: 'return=minimal' })
                });
                if (!response.ok) {
                    throw new Error(`Supabase 清空日志失败: HTTP ${response.status}`);
                }
            } else {
                localStorage.removeItem(STORAGE_KEYS.changeLogs);
                changeLogsCache = [];
            }

            await loadChangeLog();
            showToast('所有更换日志已清空', 'success');
        } catch (error) {
            console.error('清空日志失败:', error);
            localStorage.removeItem(STORAGE_KEYS.changeLogs);
            changeLogsCache = [];
            displayChangeLog(changeLogsCache);
            updateLogSummary(changeLogsCache);
            showToast('Supabase 不可用，已清空本地日志', 'warning');
        }
    }

    // 启动应用
    initApp();
});

