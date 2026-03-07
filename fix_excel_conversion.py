import pandas as pd
import json
import re
from datetime import datetime

def main():
    print("开始修复Excel转换问题...")

    # 创建备份
    import shutil
    import os
    if os.path.exists('data/schedule.json'):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"data/schedule_backup_{timestamp}.json"
        shutil.copy2('data/schedule.json', backup_file)
        print(f"已创建备份文件: {backup_file}")

    # 处理10.09-10.31.xlsx文件（主要问题文件）
    excel_file = '10.09-10.31.xlsx'
    year = "2025"
    month = "10"

    try:
        df = pd.read_excel(excel_file, header=None)
        print(f"处理文件: {excel_file}")
        print(f"Excel总行数: {len(df)}")

        result = {}

        for start_row in range(2, len(df), 2):
            if start_row + 1 >= len(df):
                break

            time_row = df.iloc[start_row]
            name_row = df.iloc[start_row + 1]

            date_cell = time_row[0]
            if pd.isna(date_cell):
                continue

            # 处理日期
            if isinstance(date_cell, (int, float)):
                date_float = float(date_cell)
                date_str_full = f"{date_float:.2f}"
                integer_part, decimal_part = date_str_full.split('.')
                day = decimal_part.zfill(2)

                if int(day) < 1 or int(day) > 31:
                    continue

                date_str = f"{year}-{month}-{day}"

                if date_str not in result:
                    result[date_str] = []

                print(f"  处理日期: {date_str}")

                # 正确的列映射：
                # B列(1): 二层时段1 | C列(2): 二层时段2(19:00-21:00)
                # D列(3): 三层时段1 | E列(4): 三层时段2(19:00-21:00)
                # F列(5): 四层时段1 | G列(6): 四层时段2(19:00-21:00)

                # 处理二层
                if not pd.isna(time_row[1]) and not pd.isna(name_row[1]):
                    time_slot = str(time_row[1]).strip()
                    name = str(name_row[1]).strip()
                    if time_slot and name:
                        result[date_str].append({
                            "floor": "二层",
                            "time": time_slot,
                            "name": name,
                            "slot": 1  # B列是时段1
                        })

                if not pd.isna(time_row[2]) and not pd.isna(name_row[2]):
                    time_slot = str(time_row[2]).strip()
                    name = str(name_row[2]).strip()
                    if time_slot and name:
                        result[date_str].append({
                            "floor": "二层",
                            "time": time_slot,
                            "name": name,
                            "slot": 2  # C列是时段2(19:00-21:00)
                        })

                # 处理三层
                if not pd.isna(time_row[3]) and not pd.isna(name_row[3]):
                    time_slot = str(time_row[3]).strip()
                    name = str(name_row[3]).strip()
                    if time_slot and name:
                        result[date_str].append({
                            "floor": "三层",
                            "time": time_slot,
                            "name": name,
                            "slot": 1  # D列是时段1
                        })

                if not pd.isna(time_row[4]) and not pd.isna(name_row[4]):
                    time_slot = str(time_row[4]).strip()
                    name = str(name_row[4]).strip()
                    if time_slot and name:
                        result[date_str].append({
                            "floor": "三层",
                            "time": time_slot,
                            "name": name,
                            "slot": 2  # E列是时段2(19:00-21:00)
                        })

                # 处理四层
                if not pd.isna(time_row[5]) and not pd.isna(name_row[5]):
                    time_slot = str(time_row[5]).strip()
                    name = str(name_row[5]).strip()
                    if time_slot and name:
                        result[date_str].append({
                            "floor": "四层",
                            "time": time_slot,
                            "name": name,
                            "slot": 1  # F列是时段1
                        })

                if not pd.isna(time_row[6]) and not pd.isna(name_row[6]):
                    time_slot = str(time_row[6]).strip()
                    name = str(name_row[6]).strip()
                    if time_slot and name:
                        result[date_str].append({
                            "floor": "四层",
                            "time": time_slot,
                            "name": name,
                            "slot": 2  # G列是时段2(19:00-21:00)
                        })

        # 验证数据
        print("\n验证数据...")
        slot_stats = {'二层': {1: 0, 2: 0}, '三层': {1: 0, 2: 0}, '四层': {1: 0, 2: 0}}
        errors = 0

        for date, entries in result.items():
            for entry in entries:
                floor = entry['floor']
                slot = entry.get('slot', 1)
                time = entry['time']

                if floor in slot_stats and slot in slot_stats[floor]:
                    slot_stats[floor][slot] += 1

                # 验证19:00-21:00的slot
                if "19:00" in time and slot != 2:
                    print(f"  错误: {date} {floor} {time} 的slot应该是2，但实际是{slot}")
                    errors += 1

        print("Slot分布统计:")
        for floor in ['二层', '三层', '四层']:
            slot1 = slot_stats[floor][1]
            slot2 = slot_stats[floor][2]
            print(f"  {floor}: slot1={slot1}, slot2={slot2}")

        if errors == 0:
            print("数据验证通过！")

            # 读取现有数据
            with open('data/schedule.json', 'r', encoding='utf-8') as f:
                existing_data = json.load(f)

            # 更新10月份的数据
            updated_count = 0
            for date, entries in result.items():
                if date in existing_data:
                    existing_data[date] = entries
                    updated_count += 1

            # 保存更新后的数据
            with open('data/schedule.json', 'w', encoding='utf-8') as f:
                json.dump(existing_data, f, ensure_ascii=False, indent=2)

            print(f"更新完成！共更新了 {updated_count} 天的数据")
            print("请刷新网页查看修复后的效果。")
        else:
            print(f"发现 {errors} 个错误，请检查转换逻辑")

    except Exception as e:
        print(f"处理文件时出错: {e}")

if __name__ == "__main__":
    main()