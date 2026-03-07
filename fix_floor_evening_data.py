import json

def fix_floor_evening_slots():
    """修复二层和三层19:00-21:00的slot弄反问题"""

    with open('data/schedule.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("开始修复二层和三层19:00-21:00的slot问题...")
    print("=" * 60)

    fixed_count = 0
    error_count = 0

    for date in sorted(data.keys()):
        entries = data[date]
        date_fixed = False

        # 修复19:00-21:00时段的slot
        for entry in entries:
            if entry['time'] == '19:00-21:00':
                floor = entry['floor']
                current_slot = entry.get('slot', 1)

                # 19:00-21:00应该是slot 2
                if floor in ['二层', '三层', '四层'] and current_slot != 2:
                    old_slot = current_slot
                    entry['slot'] = 2
                    fixed_count += 1
                    date_fixed = True

                    print(f"  {date} {floor} 19:00-21:00: {entry['name']} (slot {old_slot} -> slot 2)")

        # 如果这个日期有修复，重新排序entries
        if date_fixed:
            # 按楼层和slot排序
            def sort_key(entry):
                floor_order = {'二层': 1, '三层': 2, '四层': 3}
                return (floor_order.get(entry['floor'], 0), entry.get('slot', 1))

            entries.sort(key=sort_key)
            data[date] = entries

    # 保存修复后的数据
    with open('data/schedule.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("=" * 60)
    print(f"✅ 修复完成！")
    print(f"📊 共修复了 {fixed_count} 个条目的slot信息")

    # 验证修复结果
    print("\n验证修复结果...")
    verify_fix()

def verify_fix():
    """验证修复结果"""
    with open('data/schedule.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 统计19:00-21:00时段的slot分布
    slot_stats = {'二层': {1: 0, 2: 0}, '三层': {1: 0, 2: 0}, '四层': {1: 0, 2: 0}}

    for date, entries in data.items():
        for entry in entries:
            if entry['time'] == '19:00-21:00':
                floor = entry['floor']
                slot = entry.get('slot', 1)

                if floor in slot_stats and slot in slot_stats[floor]:
                    slot_stats[floor][slot] += 1

    print("修复后19:00-21:00时段的slot统计:")
    total_correct = 0
    total_entries = 0

    for floor in ['二层', '三层', '四层']:
        slot1_count = slot_stats[floor][1]
        slot2_count = slot_stats[floor][2]
        total_entries += slot1_count + slot2_count
        total_correct += slot2_count

        print(f"  {floor}: slot1={slot1_count}, slot2={slot2_count}")

    accuracy = (total_correct / total_entries * 100) if total_entries > 0 else 0
    print(f"\n📈 正确率: {accuracy:.1f}% ({total_correct}/{total_entries} 个19:00-21:00时段被正确标记为slot2)")

    # 显示最近几天的数据作为示例
    print(f"\n最近5天的数据验证:")
    recent_dates = sorted(data.keys())[-5:]

    for date in recent_dates:
        print(f"\n日期: {date}")
        for floor in ['二层', '三层', '四层']:
            evening_entry = None
            for entry in data[date]:
                if entry['floor'] == floor and entry['time'] == '19:00-21:00':
                    evening_entry = entry
                    break

            if evening_entry:
                slot = evening_entry.get('slot', 1)
                status = "✅" if slot == 2 else "❌"
                print(f"  {floor}19:00-21:00: {evening_entry['name']} (slot={slot}) {status}")
            else:
                print(f"  {floor}19:00-21:00: 无数据")

if __name__ == "__main__":
    fix_floor_evening_slots()