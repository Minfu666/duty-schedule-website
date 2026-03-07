import pandas as pd
import json
import re
from datetime import datetime

def parse_excel_correctly(excel_file, year="2025", month_prefix=""):
    """正确解析Excel文件，修复slot分配问题"""
    try:
        df = pd.read_excel(excel_file, header=None)
    except Exception as e:
        print(f"❌ 无法读取文件 {excel_file}: {e}")
        return {}

    result = {}

    # 从文件名提取月份信息
    if month_prefix:
        month = month_prefix.zfill(2)
    else:
        # 尝试从文件名解析月份
        filename = str(excel_file)
        month_match = re.search(r'(\d+)\.(\d+)', filename)
        if month_match:
            month = month_match.group(2).zfill(2)
        else:
            month = "01"  # 默认月份

    print(f"\n处理文件: {excel_file} (年份: {year}, 月份: {month})")
    print(f"Excel总行数: {len(df)}")

    # 从第3行开始，每2行处理一组数据
    processed_days = 0
    for start_row in range(2, len(df), 2):
        if start_row + 1 >= len(df):
            break

        time_row = df.iloc[start_row]    # 时间行
        name_row = df.iloc[start_row + 1]  # 人名行

        # 获取日期（A列）
        date_cell = time_row[0]
        if pd.isna(date_cell):
            continue

        # 处理日期格式
        date_str = None
        if isinstance(date_cell, (int, float)):
            date_float = float(date_cell)
            date_str_full = f"{date_float:.2f}"
            integer_part, decimal_part = date_str_full.split('.')
            day = decimal_part.zfill(2)

            if int(day) < 1 or int(day) > 31:
                continue

            date_str = f"{year}-{month}-{day}"

        if not date_str:
            continue

        print(f"  📅 处理日期: {date_str} (第{start_row+1}行)")

        if date_str not in result:
            result[date_str] = []

        # 检测结构类型：检查是否是合并单元格
        is_merged_structure = (
            not pd.isna(time_row[1]) and pd.isna(time_row[2]) and  # B列有值，C列为空
            not pd.isna(time_row[3]) and pd.isna(time_row[4]) and  # D列有值，E列为空
            not pd.isna(time_row[5]) and pd.isna(time_row[6])      # F列有值，G列为空
        )

        if is_merged_structure:
            print("    🔄 检测到合并单元格结构（每层一个时间段）")
            # 合并单元格结构：每层只有一个时间段和一个人名
            # B列: 二层时间 | D列: 三层时间 | F列: 四层时间
            # B列下一行: 二层人名 | D列下一行: 三层人名 | F列下一行: 四层人名

            # 处理二层
            if not pd.isna(time_row[1]) and not pd.isna(name_row[1]):
                time_slot = str(time_row[1]).strip()
                name = str(name_row[1]).strip()
                if not name or name == 'nan':
                    name = "空"
                if time_slot and time_slot != 'nan':
                    # 根据时间段判断slot
                    slot = 2 if "19:00" in time_slot else 1
                    result[date_str].append({"floor": "二层", "time": time_slot, "name": name, "slot": slot})
                    print(f"      添加(二层): {time_slot} - {name} (slot={slot})" if name != "空" else f"      添加(二层): {time_slot} - 空 (slot={slot})")

            # 处理三层
            if not pd.isna(time_row[3]) and not pd.isna(name_row[3]):
                time_slot = str(time_row[3]).strip()
                name = str(name_row[3]).strip()
                if not name or name == 'nan':
                    name = "空"
                if time_slot and time_slot != 'nan':
                    # 根据时间段判断slot
                    slot = 2 if "19:00" in time_slot else 1
                    result[date_str].append({"floor": "三层", "time": time_slot, "name": name, "slot": slot})
                    print(f"      添加(三层): {time_slot} - {name} (slot={slot})" if name != "空" else f"      添加(三层): {time_slot} - 空 (slot={slot})")

            # 处理四层
            if not pd.isna(time_row[5]) and not pd.isna(name_row[5]):
                time_slot = str(time_row[5]).strip()
                name = str(name_row[5]).strip()
                if not name or name == 'nan':
                    name = "空"
                if time_slot and time_slot != 'nan':
                    # 根据时间段判断slot
                    slot = 2 if "19:00" in time_slot else 1
                    result[date_str].append({"floor": "四层", "time": time_slot, "name": name, "slot": slot})
                    print(f"      添加(四层): {time_slot} - {name} (slot={slot})" if name != "空" else f"      添加(四层): {time_slot} - 空 (slot={slot})")

        else:
            print("    🔄 正常单元格结构（每层两个时间段）")
            # 正确的列映射：
            # B列: 二层时间1 | C列: 二层时间2(19:00-21:00)
            # D列: 三层时间1 | E列: 三层时间2(19:00-21:00)
            # F列: 四层时间1 | G列: 四层时间2(19:00-21:00)

            # 处理二层（两个时间段）
            if not pd.isna(time_row[1]) and not pd.isna(name_row[1]):
                time_slot = str(time_row[1]).strip()
                name = str(name_row[1]).strip()
                if not name or name == 'nan':
                    name = "空"
                if time_slot and time_slot != 'nan':
                    # 根据时间段判断slot（B列通常是时段1）
                    slot = 1  # B列通常是第一个时段
                    result[date_str].append({"floor": "二层", "time": time_slot, "name": name, "slot": slot})
                    print(f"      添加(二层-时段1): {time_slot} - {name} (slot={slot})" if name != "空" else f"      添加(二层-时段1): {time_slot} - 空 (slot={slot})")

            if not pd.isna(time_row[2]) and not pd.isna(name_row[2]):
                time_slot = str(time_row[2]).strip()
                name = str(name_row[2]).strip()
                if not name or name == 'nan':
                    name = "空"
                if time_slot and time_slot != 'nan':
                    # C列通常是19:00-21:00，应该是slot 2
                    slot = 2
                    result[date_str].append({"floor": "二层", "time": time_slot, "name": name, "slot": slot})
                    print(f"      添加(二层-时段2): {time_slot} - {name} (slot={slot})" if name != "空" else f"      添加(二层-时段2): {time_slot} - 空 (slot={slot})")

            # 处理三层（两个时间段）
            if not pd.isna(time_row[3]) and not pd.isna(name_row[3]):
                time_slot = str(time_row[3]).strip()
                name = str(name_row[3]).strip()
                if not name or name == 'nan':
                    name = "空"
                if time_slot and time_slot != 'nan':
                    # D列通常是第一个时段
                    slot = 1
                    result[date_str].append({"floor": "三层", "time": time_slot, "name": name, "slot": slot})
                    print(f"      添加(三层-时段1): {time_slot} - {name} (slot={slot})" if name != "空" else f"      添加(三层-时段1): {time_slot} - 空 (slot={slot})")

            if not pd.isna(time_row[4]) and not pd.isna(name_row[4]):
                time_slot = str(time_row[4]).strip()
                name = str(name_row[4]).strip()
                if not name or name == 'nan':
                    name = "空"
                if time_slot and time_slot != 'nan':
                    # E列通常是19:00-21:00，应该是slot 2
                    slot = 2
                    result[date_str].append({"floor": "三层", "time": time_slot, "name": name, "slot": slot})
                    print(f"      添加(三层-时段2): {time_slot} - {name} (slot={slot})" if name != "空" else f"      添加(三层-时段2): {time_slot} - 空 (slot={slot})")

            # 处理四层（两个时间段）
            if not pd.isna(time_row[5]) and not pd.isna(name_row[5]):
                time_slot = str(time_row[5]).strip()
                name = str(name_row[5]).strip()
                if not name or name == 'nan':
                    name = "空"
                if time_slot and time_slot != 'nan':
                    # F列通常是第一个时段
                    slot = 1
                    result[date_str].append({"floor": "四层", "time": time_slot, "name": name, "slot": slot})
                    print(f"      添加(四层-时段1): {time_slot} - {name} (slot={slot})" if name != "空" else f"      添加(四层-时段1): {time_slot} - 空 (slot={slot})")

            if not pd.isna(time_row[6]) and not pd.isna(name_row[6]):
                time_slot = str(time_row[6]).strip()
                name = str(name_row[6]).strip()
                if not name or name == 'nan':
                    name = "空"
                if time_slot and time_slot != 'nan':
                    # G列通常是19:00-21:00，应该是slot 2
                    slot = 2
                    result[date_str].append({"floor": "四层", "time": time_slot, "name": name, "slot": slot})
                    print(f"      添加(四层-时段2): {time_slot} - {name} (slot={slot})" if name != "空" else f"      添加(四层-时段2): {time_slot} - 空 (slot={slot})")

        processed_days += 1

    print(f"  ✅ 处理了 {processed_days} 天的数据")
    return result

def validate_schedule_data(data):
    """验证排班数据的完整性"""
    print("\n🔍 验证数据完整性...")

    total_errors = 0
    slot_stats = {'二层': {1: 0, 2: 0}, '三层': {1: 0, 2: 0}, '四层': {1: 0, 2: 0}}

    for date, entries in data.items():
        for entry in entries:
            floor = entry['floor']
            slot = entry.get('slot', 1)
            time = entry['time']

            # 统计slot分布
            if floor in slot_stats and slot in slot_stats[floor]:
                slot_stats[floor][slot] += 1

            # 验证19:00-21:00的slot
            if "19:00" in time and slot != 2:
                print(f"  ❌ 错误: {date} {floor} {time} 的slot应该是2，但实际是{slot}")
                total_errors += 1

    print("\n📊 Slot分布统计:")
    for floor in ['二层', '三层', '四层']:
        slot1 = slot_stats[floor][1]
        slot2 = slot_stats[floor][2]
        print(f"  {floor}: slot1={slot1}, slot2={slot2}")

    if total_errors == 0:
        print("✅ 数据验证通过！所有19:00-21:00时段都正确标记为slot2")
    else:
        print(f"❌ 发现 {total_errors} 个slot错误")

    return total_errors == 0

def merge_all_excel_files():
    """合并所有Excel文件的数据"""
    all_data = {}

    # 定义文件处理顺序（按月份）
    excel_files = [
        ('6月巡馆.xlsx', '2025', '06'),
        ('9.01-9.07巡馆.xlsx', '2025', '09'),
        ('9.08-9.14.xlsx', '2025', '09'),
        ('9.15-9.30.xlsx', '2025', '09'),
        ('10.09-10.31.xlsx', '2025', '10')
    ]

    for excel_file, year, month in excel_files:
        try:
            file_data = parse_excel_correctly(excel_file, year, month)
            # 合并数据，后面的数据会覆盖前面的（如果日期重复）
            for date, entries in file_data.items():
                if date in all_data:
                    print(f"  ⚠️  日期 {date} 重复，将使用新数据覆盖")
                all_data[date] = entries
        except Exception as e:
            print(f"❌ 处理文件 {excel_file} 时出错: {e}")

    # 按日期排序
    sorted_data = dict(sorted(all_data.items()))

    # 验证数据
    if validate_schedule_data(sorted_data):
        # 保存合并后的数据
        with open('data/schedule.json', 'w', encoding='utf-8') as f:
            json.dump(sorted_data, f, ensure_ascii=False, indent=2)

        print(f"\n🎉 数据合并完成！")
        print(f"📅 总计处理了 {len(sorted_data)} 天的数据")

        # 统计信息
        total_entries = sum(len(entries) for entries in sorted_data.values())
        print(f"📊 总值班条目: {total_entries}")

        # 显示日期范围
        if sorted_data:
            dates = list(sorted_data.keys())
            print(f"📅 数据范围: {dates[0]} 至 {dates[-1]}")

        return sorted_data
    else:
        print("❌ 数据验证失败，请检查转换逻辑")
        return None

if __name__ == "__main__":
    print("开始重新转换Excel文件...")

    # 创建备份
    import shutil
    import os
    if os.path.exists('data/schedule.json'):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"data/schedule_backup_{timestamp}.json"
        shutil.copy2('data/schedule.json', backup_file)
        print(f"已创建备份文件: {backup_file}")

    # 重新转换数据
    result = merge_all_excel_files()

    if result:
        print("\n转换完成！请刷新网页查看修复后的数据。")
    else:
        print("\n转换失败，请检查错误信息。")