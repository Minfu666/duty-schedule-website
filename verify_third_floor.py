import json

def verify_third_floor_data():
    """验证三楼19:00-21:00数据的完整性"""

    with open('data/schedule.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("验证三楼19:00-21:00数据...")

    total_days = 0
    days_with_third_floor_evening = 0
    missing_third_floor_evening = []
    unknown_floor_count = 0

    for date in sorted(data.keys()):
        entries = data[date]
        total_days += 1

        # 检查是否有三楼19:00-21:00的数据
        has_third_floor_evening = False
        has_unknown_floor = False

        for entry in entries:
            if entry['floor'] == '三层' and entry['time'] == '19:00-21:00':
                has_third_floor_evening = True
                days_with_third_floor_evening += 1

            if entry['floor'] == '未知':
                has_unknown_floor = True
                unknown_floor_count += 1

        if not has_third_floor_evening:
            missing_third_floor_evening.append(date)

    print(f"总天数: {total_days}")
    print(f"有三楼19:00-21:00数据的天数: {days_with_third_floor_evening}")
    print(f"缺失三楼19:00-21:00数据的天数: {len(missing_third_floor_evening)}")
    print(f"未知楼层条目总数: {unknown_floor_count}")

    if missing_third_floor_evening:
        print("\n缺失三楼19:00-21:00数据的日期:")
        for date in missing_third_floor_evening[:10]:  # 只显示前10个
            print(f"  {date}")
        if len(missing_third_floor_evening) > 10:
            print(f"  ... 还有 {len(missing_third_floor_evening) - 10} 天")
    else:
        print("\n所有日期都有三楼19:00-21:00数据!")

    # 检查最近几天的情况
    print("\n最近5天的三楼数据详情:")
    recent_dates = sorted(data.keys())[-5:]
    for date in recent_dates:
        entries = data[date]
        third_floor_entries = [e for e in entries if e['floor'] == '三层']

        print(f"\n{date}:")
        for entry in third_floor_entries:
            print(f"  {entry['time']}: {entry['name']}")

if __name__ == "__main__":
    verify_third_floor_data()