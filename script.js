// script.js
document.addEventListener('DOMContentLoaded', function() {
    // 全局变量
    let scheduleData = {};
    let currentDate = new Date().toISOString().split('T')[0];
    let isAdminMode = false;
    let currentSelectedSlot = null;
    const ADMIN_PASSWORD = "admin123"; // 实际使用时应该更复杂

    // 保存排班数据到本地存储
    function saveScheduleData() {
        localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
    }

    // 初始化应用
    async function initApp() {
        showLoading();
        try {
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

    // 加载JSON数据
    async function loadScheduleData() {
        try {
            const response = await fetch(`data/schedule.json?_t=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error(`HTTP错误! 状态: ${response.status}`);
            }
            const data = await response.json();
            
            // 转换数据格式，添加slot信息
            scheduleData = processScheduleData(data);
            console.log('数据加载成功', scheduleData);
            
        } catch (error) {
            console.error('加载数据失败:', error);
            showToast('数据加载失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 处理数据格式，添加slot信息
    function processScheduleData(data) {
        const processedData = {};
        
        for (const [date, entries] of Object.entries(data)) {
            processedData[date] = [];
            
            // 按楼层分组
            const floorGroups = {
                '二层': entries.filter(item => item.floor === '二层'),
                '三层': entries.filter(item => item.floor === '三层'),
                '四层': entries.filter(item => item.floor === '四层')
            };
            
            // 为每个时间段添加slot编号
            for (const [floor, items] of Object.entries(floorGroups)) {
                items.forEach((item, index) => {
                    processedData[date].push({
                        ...item,
                        slot: index + 1
                    });
                });
            }
        }
        
        return processedData;
    }

    // 设置事件监听器
    function setupEventListeners() {
        setupAdminFeatures();
        setupDateNavigation();
        setupCalendarModal();
        setupSwapModal();
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

    // 处理管理员登录
    function handleAdminLogin() {
        const password = document.getElementById('admin-password').value;
        
        if (password === ADMIN_PASSWORD) {
            isAdminMode = true;
            document.getElementById('admin-mode').textContent = '退出管理员';
            document.getElementById('admin-mode').classList.add('active');
            document.body.classList.add('admin-mode');
            
            document.getElementById('admin-modal').style.display = 'none';
            document.body.style.overflow = '';
            
            document.getElementById('admin-password').value = '';
            
            showToast('管理员模式已启用', 'success');
        } else {
            showToast('密码错误', 'error');
        }
    }

    // 退出管理员模式
    function logoutAdmin() {
        isAdminMode = false;
        document.getElementById('admin-mode').textContent = '管理员模式';
        document.getElementById('admin-mode').classList.remove('active');
        document.body.classList.remove('admin-mode');
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
            date.setTime(Date.now());
        } else {
            date.setDate(date.getDate() + days);
        }
        
        currentDate = date.toISOString().split('T')[0];
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
                updateDateDisplay(selectedDate);
                loadDateData(selectedDate);
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
                const formattedDate = fullDate.toISOString().split('T')[0];
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

            try {
                // 调用实际的交换逻辑
                handleSwap(currentSelectedSlot, targetDate, targetFloor, targetSlot);
                showToast('值班信息交换成功！', 'success');
            } catch (error) {
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
        todayInput.value = new Date().toISOString().split('T')[0];
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
    function handleSwap(sourceSlot, targetDate, targetFloor, targetSlot) {

        const sourceDate = sourceSlot.date;
        const sourceFloor = sourceSlot.floor;
        const sourceSlotNum = sourceSlot.slot;

        // 确保目标日期有数据结构
        if (!scheduleData[targetDate]) {
            scheduleData[targetDate] = [];
        }

        // 找到源和目标在数据中的实际对象
        let sourceEntry = scheduleData[sourceDate].find(item => 
            item.floor === sourceFloor && item.slot === sourceSlotNum
        );
        let targetEntry = scheduleData[targetDate].find(item => 
            item.floor === targetFloor && item.slot === targetSlot
        );

        if (!sourceEntry) {
            showToast('未找到源值班信息。', 'error');
            return;
        }

        // 确保目标日期有数据结构
        if (!scheduleData[targetDate]) {
            scheduleData[targetDate] = [];
        }

        // 执行交换逻辑
        if (targetEntry) {
            // 交换时间和名字
            const tempTime = sourceEntry.time;
            const tempName = sourceEntry.name;
            sourceEntry.time = targetEntry.time;
            sourceEntry.name = targetEntry.name;
            targetEntry.time = tempTime;
            targetEntry.name = tempName;
            showToast('值班信息已交换！', 'success');
            highlightSwappedBlock(sourceFloor, sourceSlot);
            highlightSwappedBlock(targetFloor, targetSlot);
        } else {
            // 如果目标时段不存在，则将源时段移动到目标日期/楼层/时段，并清空源时段
            // 注意：这里需要创建一个新的对象，而不是直接引用，以避免修改原始数据结构
            const newTargetEntry = {
                floor: targetFloor,
                time: sourceEntry.time,
                name: sourceEntry.name,
                slot: targetSlot
            };
            scheduleData[targetDate].push(newTargetEntry);

            // 清空源时段
            sourceEntry.time = '暂无';
            sourceEntry.name = '暂无';
            showToast('值班信息已移动！', 'success');
            highlightSwappedBlock(targetFloor, targetSlot);
        }

        // 保存更新后的数据
        saveScheduleData();
        // 更新UI显示
        updateDateDisplay(currentDate);

        // 更新UI
        loadDateData(sourceDate);
        if (sourceDate !== targetDate) {
            loadDateData(targetDate);
        }

        document.getElementById('swap-modal').style.display = 'none';
        document.body.style.overflow = '';
        currentSelectedSlot = null;


    }

    // 执行交换操作
    async function performSwap(sourceDate, sourceFloor, sourceSlot, targetDate, targetFloor, targetSlot) {
        showLoading();
        
        try {
            // 获取源数据和目标数据
            const sourceData = getSlotData(sourceDate, sourceFloor, sourceSlot);
            const targetData = getSlotData(targetDate, targetFloor, targetSlot);
            
            if (!sourceData) {
                throw new Error(`源数据不存在: ${sourceDate} ${sourceFloor} 时段${sourceSlot}`);
            }

            // 交换数据
            setSlotData(sourceDate, sourceFloor, sourceSlot, targetData || { time: '--:--', name: '暂无' });
            
            if (targetData) {
                setSlotData(targetDate, targetFloor, targetSlot, sourceData);
            } else {
                // 如果目标数据不存在，只设置源数据到目标位置
                setSlotData(targetDate, targetFloor, targetSlot, sourceData);
                // 清空源位置
                setSlotData(sourceDate, sourceFloor, sourceSlot, { time: '--:--', name: '暂无' });
            }

            // 更新显示
            if (sourceDate === currentDate) {
                updateFloorDisplay(sourceFloor);
            }
            if (targetDate === currentDate) {
                updateFloorDisplay(targetFloor);
            }

            showToast('交换成功完成！');
            
            // 模拟保存到服务器（实际使用时需要实现）
            await simulateSaveToServer();
            
        } catch (error) {
            throw error;
        } finally {
            hideLoading();
        }
    }

    // 获取特定时间段数据
    function getSlotData(date, floor, slot) {
        const dayData = scheduleData[date];
        if (!dayData) return null;
        
        return dayData.find(item => 
            item.floor === floor && 
            item.slot === parseInt(slot)
        );
    }

    // 设置特定时间段数据
    function setSlotData(date, floor, slot, data) {
        if (!scheduleData[date]) {
            scheduleData[date] = [];
        }
        
        const index = scheduleData[date].findIndex(item => 
            item.floor === floor && 
            item.slot === parseInt(slot)
        );
        
        const newData = { 
            ...data, 
            floor: floor, 
            slot: parseInt(slot) 
        };
        
        if (index !== -1) {
            scheduleData[date][index] = newData;
        } else {
            scheduleData[date].push(newData);
        }
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

    // 渲染日历
    function renderCalendar() {
        const calendarDiv = document.getElementById('calendar');
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        let html = `
            <div class="calendar-header">
                <h3>${year}年${month + 1}月</h3>
            </div>
            <div class="calendar-grid-header">
                <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
            </div>
            <div class="calendar-days">
        `;

        // 添加空白格子
        for (let i = 0; i < firstDay.getDay(); i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // 添加日期格子
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasData = scheduleData[dateStr];
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isCurrent = dateStr === currentDate;
            
            let dayClass = 'calendar-day';
            if (isToday) dayClass += ' today';
            if (isCurrent) dayClass += ' current';
            if (hasData) dayClass += ' has-data';
            
            html += `<div class="${dayClass}" data-date="${dateStr}">${day}</div>`;
        }

        html += '</div>';
        calendarDiv.innerHTML = html;

        // 添加日期点击事件
        calendarDiv.querySelectorAll('.calendar-day:not(.empty)').forEach(day => {
            day.addEventListener('click', function() {
                const date = this.getAttribute('data-date');
                loadDateData(date);
                
                const modal = document.getElementById('calendar-modal');
                modal.style.display = 'none';
                document.body.style.overflow = '';
            });
        });
    }

    // 模拟保存到服务器
    async function simulateSaveToServer() {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('数据已保存（模拟）', scheduleData);
                resolve();
            }, 500);
        });
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

    // 启动应用
    initApp();
});

