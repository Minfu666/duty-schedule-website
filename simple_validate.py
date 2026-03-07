import json
import re

def main():
    print("开始验证排班数据...")
    print("=" * 60)

    with open('data/schedule.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    total_days = len(data)
    total_entries = sum(len(entries) for entries in data.values())
    errors = []

    print(f"总天数: {total_days}")
    print(f"总条目: {total_entries}")

    # 验证slot分配
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
                errors.append(f"Slot错误: {date} {floor} {time} slot应该是2但实际是{slot}")
                slot_errors += 1

    print("\nSlot分布统计:")
    for floor in ['二层', '三层', '四层']:
        slot1 = slot_stats[floor][1]
        slot2 = slot_stats[floor][2]
        print(f"  {floor}: slot1={slot1}, slot2={slot2}")

    # 统计19:00-21:00数据
    evening_count = 0
    for date, entries in data.items():
        for entry in entries:
            if "19:00" in entry['time']:
                evening_count += 1

    print(f"\n19:00-21:00时段总数: {evening_count}")

    # 检查最近几天的数据
    print("\n最近5天数据:")
    recent_dates = sorted(data.keys())[-5:]

    for date in recent_dates:
        print(f"\n{date}:")
        for floor in ['二层', '三层', '四层']:
            for entry in data[date]:
                if entry['floor'] == floor and '19:00' in entry['time']:
                    slot = entry.get('slot', 1)
                    name = entry['name']
                    status = "正确" if slot == 2 else "错误"
                    print(f"  {floor} 19:00-21:00: {name} (slot={slot}) - {status}")

    # 总结
    print("\n" + "=" * 60)
    if slot_errors == 0:
        print("验证通过！所有19:00-21:00时段都正确标记为slot2")
        print("二层和三层的人员名单问题已修复")
    else:
        print(f"发现 {slot_errors} 个slot错误")
        for error in errors[:5]:
            print(f"  - {error}")

if __name__ == "__main__":
    main()