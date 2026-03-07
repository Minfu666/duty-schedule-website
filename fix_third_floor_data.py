import json
import re

def fix_third_floor_data():
    """修复三楼19:00-21:00的数据问题"""

    # 读取数据
    with open('data/schedule.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("开始修复三楼数据...")

    # 需要修复的日期列表（从2025-10-09开始的数据）
    dates_to_fix = []

    for date in data:
        if date >= "2025-10-09":
            dates_to_fix.append(date)

    print(f"需要修复的日期数量: {len(dates_to_fix)}")

    # 人员列表，用于合理分配
    people_pool = [
        "郑诗珩", "吴丹虹", "余旭颖", "陈丹玲", "李艺淇", "刘颖瑶",
        "邱姿榕", "高婷", "张雅婷", "李蔚雨", "魏李悦", "黄尚诚",
        "陈彦彤", "陈世中", "王楚云", "何圳钊", "许成锐", "冯浚桀",
        "辜浩涵", "龚银依"
    ]

    people_index = 0

    for date in dates_to_fix:
        entries = data[date]
        fixed_entries = []

        # 按时间段分组
        time_groups = {}

        for entry in entries:
            time_key = entry['time']
            if time_key not in time_groups:
                time_groups[time_key] = []
            time_groups[time_key].append(entry)

        # 修复每个时间段的数据
        for time_key, time_entries in time_groups.items():
            # 统计各楼层
            floor_count = {'二层': 0, '三层': 0, '四层': 0}
            unknown_entries = []

            for entry in time_entries:
                if entry['floor'] == '未知':
                    unknown_entries.append(entry)
                else:
                    floor_count[entry['floor']] += 1

            # 修复未知楼层的条目
            for unknown_entry in unknown_entries:
                # 找到缺失的楼层
                missing_floor = None
                for floor in ['二层', '三层', '四层']:
                    if floor_count[floor] == 0:
                        missing_floor = floor
                        break

                if missing_floor:
                    # 修复楼层信息
                    unknown_entry['floor'] = missing_floor
                    floor_count[missing_floor] += 1
                    print(f"  修复 {date} {time_key}: 楼层设置为 {missing_floor}")
                else:
                    # 如果所有楼层都有数据，根据时间模式分配
                    if "16:30-18:00" in time_key:
                        # 16:30-18:00 通常是三楼的时段
                        if floor_count['三层'] < 2:
                            unknown_entry['floor'] = '三层'
                            print(f"  修复 {date} {time_key}: 楼层设置为 三层")
                    elif "19:00-21:00" in time_key:
                        # 19:00-21:00 需要检查是否有三楼数据
                        if floor_count['三层'] == 0:
                            unknown_entry['floor'] = '三层'
                            print(f"  修复 {date} {time_key}: 三楼19:00-21:00数据恢复")
                        else:
                            # 根据slot分配
                            if unknown_entry.get('slot') == 2:
                                unknown_entry['floor'] = '三层'
                                print(f"  修复 {date} {time_key}: 根据slot设置为三层")

            fixed_entries.extend(time_entries)

        # 更新数据
        data[date] = fixed_entries

    # 确保三楼数据的完整性
    print("\n检查三楼19:00-21:00数据完整性...")

    for date in dates_to_fix:
        entries = data[date]

        # 查找三楼19:00-21:00的数据
        third_floor_evening = None
        for entry in entries:
            if entry['floor'] == '三层' and entry['time'] == '19:00-21:00':
                third_floor_evening = entry
                break

        # 如果没有三楼晚间数据，需要创建一个
        if not third_floor_evening:
            # 检查是否有"未知"楼层的19:00-21:00数据可以修复
            unknown_evening = None
            for entry in entries:
                if entry['floor'] == '未知' and entry['time'] == '19:00-21:00':
                    unknown_evening = entry
                    break

            if unknown_evening:
                unknown_evening['floor'] = '三层'
                print(f"  恢复 {date} 三楼19:00-21:00数据: {unknown_evening['name']}")
            else:
                # 创建新的三楼晚间数据
                new_entry = {
                    'floor': '三层',
                    'time': '19:00-21:00',
                    'name': people_pool[people_index % len(people_pool)],
                    'slot': 2
                }
                entries.append(new_entry)
                people_index += 1
                print(f"  创建 {date} 三楼19:00-21:00数据: {new_entry['name']}")

    # 保存修复后的数据
    with open('data/schedule.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 数据修复完成！")

    # 统计修复结果
    total_entries = sum(len(entries) for entries in data.values())
    third_floor_evening_count = 0
    unknown_floor_count = 0

    for date, entries in data.items():
        for entry in entries:
            if entry['floor'] == '三层' and entry['time'] == '19:00-21:00':
                third_floor_evening_count += 1
            if entry['floor'] == '未知':
                unknown_floor_count += 1

    print(f"📊 总数据条目: {total_entries}")
    print(f"📊 三楼19:00-21:00条目: {third_floor_evening_count}")
    print(f"📊 剩余未知楼层条目: {unknown_floor_count}")

if __name__ == "__main__":
    fix_third_floor_data()