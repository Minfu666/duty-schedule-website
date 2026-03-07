import json

def check_floor_swap_issue():
    """检查二层和三层19:00-21:00的人员名单是否有弄反的问题"""

    with open('data/schedule.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("检查二层和三层19:00-21:00的人员名单...")
    print("=" * 60)

    # 收集所有有问题的情况
    issues_found = []

    for date in sorted(data.keys()):
        entries = data[date]

        # 查找19:00-21:00的时段
        evening_entries = [entry for entry in entries if entry['time'] == '19:00-21:00']

        # 找到二层和三层的晚间数据
        second_floor = None
        third_floor = None

        for entry in evening_entries:
            if entry['floor'] == '二层':
                second_floor = entry
            elif entry['floor'] == '三层':
                third_floor = entry

        # 如果都有数据，检查是否有明显的问题
        if second_floor and third_floor:
            print(f"\n日期: {date}")
            print(f"二层19:00-21:00: {second_floor['name']}")
            print(f"三层19:00-21:00: {third_floor['name']}")

            # 检查slot信息
            second_slot = second_floor.get('slot', 'unknown')
            third_slot = third_floor.get('slot', 'unknown')
            print(f"二层slot: {second_slot}, 三层slot: {third_slot}")

            # 记录可能有问题的日期
            if second_slot != 2 or third_slot != 2:
                issues_found.append({
                    'date': date,
                    'second_floor': second_floor,
                    'third_floor': third_floor,
                    'issue': f"slot不正确 (二层:{second_slot}, 三层:{third_slot})"
                })

    print(f"\n" + "=" * 60)
    print(f"总检查天数: {len(data)}")

    if issues_found:
        print(f"发现问题的天数: {len(issues_found)}")
        print("\n问题详情:")
        for issue in issues_found:
            print(f"  {issue['date']}: {issue['issue']}")
            print(f"    二层: {issue['second_floor']['name']} (slot: {issue['second_floor'].get('slot', 'unknown')})")
            print(f"    三层: {issue['third_floor']['name']} (slot: {issue['third_floor'].get('slot', 'unknown')})")
    else:
        print("未发现明显的slot问题")

    # 检查原始Excel数据模式
    print(f"\n" + "=" * 60)
    print("检查数据模式...")

    # 统计不同slot的分布
    slot_stats = {'二层': {1: 0, 2: 0}, '三层': {1: 0, 2: 0}, '四层': {1: 0, 2: 0}}
    name_patterns = {}

    for date, entries in data.items():
        for entry in entries:
            if entry['time'] == '19:00-21:00':
                floor = entry['floor']
                slot = entry.get('slot', 1)
                name = entry['name']

                if floor in slot_stats and slot in slot_stats[floor]:
                    slot_stats[floor][slot] += 1

                # 记录姓名模式
                if name not in name_patterns:
                    name_patterns[name] = []
                name_patterns[name].append({'date': date, 'floor': floor, 'slot': slot})

    print("19:00-21:00时段的slot统计:")
    for floor in ['二层', '三层', '四层']:
        print(f"  {floor}: slot1={slot_stats[floor][1]}, slot2={slot_stats[floor][2]}")

    return issues_found, slot_stats, name_patterns

def fix_floor_swap_issues(issues_found):
    """修复楼层弄反的问题"""
    if not issues_found:
        print("没有发现需要修复的问题")
        return

    print(f"\n开始修复 {len(issues_found)} 个问题...")

    with open('data/schedule.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    fixed_count = 0

    for issue in issues_found:
        date = issue['date']
        entries = data[date]

        # 修复slot信息
        for entry in entries:
            if entry['time'] == '19:00-21:00':
                if entry['floor'] in ['二层', '三层']:
                    entry['slot'] = 2  # 19:00-21:00应该是slot2
                    fixed_count += 1

        print(f"  修复 {date}: 设置19:00-21:00为slot2")

    # 保存修复后的数据
    with open('data/schedule.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 修复完成！共修复了 {fixed_count} 个条目")

if __name__ == "__main__":
    issues, stats, patterns = check_floor_swap_issue()

    if issues:
        print(f"\n是否要修复这些问题？(y/n)")
        response = input().strip().lower()
        if response in ['y', 'yes', '是']:
            fix_floor_swap_issues(issues)
        else:
            print("跳过修复")
    else:
        print("数据看起来正常，无需修复")