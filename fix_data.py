import json

# 读取数据
with open('data/schedule.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 修复数据中的楼层映射问题
for date, entries in data.items():
    for entry in entries:
        if entry.get('floor') == '未知':
            # 根据列位置确定正确的楼层
            slot = entry.get('slot', 1)
            if slot == 1:
                # 如果是时段1，需要根据上下文判断楼层
                # 先查看同一天的其他条目来确定楼层
                same_day_floors = [e.get('floor') for e in entries if e.get('floor') != '未知']
                if '二层' not in same_day_floors:
                    entry['floor'] = '二层'
                elif '三层' not in same_day_floors:
                    entry['floor'] = '三层'
                elif '四层' not in same_day_floors:
                    entry['floor'] = '四层'
            elif slot == 2:
                # 如果是时段2，通常是19:00-21:00
                if '二层' not in [e.get('floor') for e in entries if e.get('slot') == 2 and e.get('floor') != '未知']:
                    entry['floor'] = '二层'
                elif '三层' not in [e.get('floor') for e in entries if e.get('slot') == 2 and e.get('floor') != '未知']:
                    entry['floor'] = '三层'
                elif '四层' not in [e.get('floor') for e in entries if e.get('slot') == 2 and e.get('floor') != '未知']:
                    entry['floor'] = '四层'

# 保存修复后的数据
with open('data/schedule.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("数据修复完成！")