import json
from datetime import datetime

def validate_schedule_completeness():
    """验证排班数据的完整性和正确性"""
    print("开始验证排班数据...")
    print("=" * 80)

    with open('data/schedule.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    total_days = len(data)
    total_entries = sum(len(entries) for entries in data.values())
    errors = []
    warnings = []

    print("数据概览:")
    print(f"  总天数: {total_days}")
    print(f"  总条目: {total_entries}")

    # 1. 验证slot分配正确性
    print("\n🔍 验证Slot分配...")
    slot_stats = {'二层': {1: 0, 2: 0}, '三层': {1: 0, 2: 0}, '四层': {1: 0, 2: 0}}
    slot_errors = 0

    for date, entries in data.items():
        for entry in entries:
            floor = entry['floor']
            slot = entry.get('slot', 1)
            time = entry['time']

            if floor in slot_stats and slot in slot_stats[floor]:
                slot_stats[floor][slot] += 1

            # 验证19:00-21:00的slot
            if "19:00" in time and slot != 2:
                errors.append(f"Slot错误: {date} {floor} {time} 的slot应该是2，但实际是{slot}")
                slot_errors += 1

    print("Slot分布统计:")
    for floor in ['二层', '三层', '四层']:
        slot1 = slot_stats[floor][1]
        slot2 = slot_stats[floor][2]
        print(f"  {floor}: slot1={slot1}, slot2={slot2}")

    if slot_errors == 0:
        print("✅ Slot分配验证通过")
    else:
        print(f"❌ 发现 {slot_errors} 个slot错误")

    # 2. 验证数据完整性
    print("\n🔍 验证数据完整性...")

    # 检查每天的数据结构
    dates_with_issues = []
    dates_with_evening_data = 0
    dates_with_weekend_only = 0
    dates_with_closed = 0

    for date in sorted(data.keys()):
        entries = data[date]
        floor_count = {'二层': 0, '三层': 0, '四层': 0}
        has_evening = False
        has_weekend_schedule = False
        has_closed = False

        for entry in entries:
            floor = entry['floor']
            time = entry['time']
            name = entry['name']

            if floor in floor_count:
                floor_count[floor] += 1

            if "19:00" in time:
                has_evening = True
                dates_with_evening_data += 1

            if "14:30" in time:
                has_weekend_schedule = True
                dates_with_weekend_only += 1

            if "闭馆" in name:
                has_closed = True
                dates_with_closed += 1

        # 检查是否有足够的数据
        if len(entries) == 0:
            errors.append(f"数据缺失: {date} 没有任何数据")
            dates_with_issues.append(date)
        elif sum(floor_count.values()) < 3:
            warnings.append(f"数据不完整: {date} 只有 {sum(floor_count.values())} 个条目")

    print(f"📈 数据统计:")
    print(f"  有19:00-21:00数据的天数: {dates_with_evening_data}")
    print(f"  周末模式天数: {dates_with_weekend_only}")
    print(f"  闭馆天数: {dates_with_closed}")

    # 3. 验证日期范围
    print("\n🔍 验证日期范围...")
    dates = sorted(data.keys())
    if dates:
        print(f"  最早日期: {dates[0]}")
        print(f"  最晚日期: {dates[-1]}")
        print(f"  日期跨度: {(datetime.strptime(dates[-1], '%Y-%m-%d') - datetime.strptime(dates[0], '%Y-%m-%d')).days + 1} 天")

    # 4. 验证人员姓名格式
    print("\n🔍 验证人员姓名...")
    name_issues = 0
    all_names = set()

    for date, entries in data.items():
        for entry in entries:
            name = entry['name']
            all_names.add(name)

            # 检查姓名格式
            if name not in ['空', '国庆节闭馆', '中秋节闭馆', '暂无']:
                if len(name.strip()) == 0:
                    name_issues += 1
                elif not any('\u4e00' <= char <= '\u9fff' for char in name):
                    # 不包含中文字符
                    if not name.replace('-', '').replace('_', '').replace(' ', '').isalpha():
                        name_issues += 1

    print(f"  独特人员数量: {len(all_names)}")
    if name_issues == 0:
        print("✅ 人员姓名格式验证通过")
    else:
        print(f"⚠️  发现 {name_issues} 个姓名格式问题")

    # 5. 验证时间格式
    print("\n🔍 验证时间格式...")
    time_patterns = set()
    time_issues = 0

    for date, entries in data.items():
        for entry in entries:
            time = entry['time']
            time_patterns.add(time)

            # 验证时间格式
            if not re.match(r'^\d{1,2}:\d{2}(-\d{1,2}:\d{2})?$', time):
                if "闭馆" not in time:
                    time_issues += 1

    print(f"  发现的时间格式: {sorted(time_patterns)}")
    if time_issues == 0:
        print("✅ 时间格式验证通过")
    else:
        print(f"⚠️  发现 {time_issues} 个时间格式问题")

    # 6. 检查最近几天的数据
    print("\n🔍 最近5天数据详情:")
    recent_dates = sorted(data.keys())[-5:]

    for date in recent_dates:
        print(f"\n  {date}:")
        for floor in ['二层', '三层', '四层']:
            floor_entries = [e for e in data[date] if e['floor'] == floor]
            if floor_entries:
                for entry in floor_entries:
                    slot = entry.get('slot', 1)
                    time = entry['time']
                    name = entry['name']
                    slot_status = "✅" if ("19:00" in time and slot == 2) or ("19:00" not in time) else "❌"
                    print(f"    {floor} {time}: {name} (slot={slot}) {slot_status}")
            else:
                print(f"    {floor}: 无数据")

    # 7. 总结报告
    print("\n" + "=" * 80)
    print("📋 验证报告总结:")
    print(f"  ✅ 总天数: {total_days}")
    print(f"  ✅ 总条目: {total_entries}")
    print(f"  {'✅' if slot_errors == 0 else '❌'} Slot错误: {slot_errors}")
    print(f"  {'✅' if len(errors) == 0 else '❌'} 严重错误: {len(errors)}")
    print(f"  {'✅' if len(warnings) == 0 else '⚠️'} 警告: {len(warnings)}")

    if errors:
        print(f"\n❌ 严重错误列表:")
        for error in errors[:10]:  # 只显示前10个
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... 还有 {len(errors) - 10} 个错误")

    if warnings:
        print(f"\n⚠️  警告列表:")
        for warning in warnings[:5]:  # 只显示前5个
            print(f"  - {warning}")
        if len(warnings) > 5:
            print(f"  ... 还有 {len(warnings) - 5} 个警告")

    # 生成验证结果
    is_valid = (slot_errors == 0 and len(errors) == 0)

    if is_valid:
        print("\n🎉 数据验证完全通过！数据质量良好。")
    else:
        print("\n⚠️  数据验证发现问题，建议修复后重新验证。")

    return {
        'is_valid': is_valid,
        'total_days': total_days,
        'total_entries': total_entries,
        'slot_errors': slot_errors,
        'errors': errors,
        'warnings': warnings,
        'slot_stats': slot_stats,
        'name_count': len(all_names)
    }

if __name__ == "__main__":
    import re
    result = validate_schedule_completeness()