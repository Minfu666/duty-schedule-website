import pandas as pd
import json
import re

def process_single_excel(excel_file, year="2025", month="10"):
    """处理单个Excel文件"""
    try:
        df = pd.read_excel(excel_file, header=None)
        result = {}

        print(f"处理文件: {excel_file}")

        for start_row in range(2, len(df), 2):
            if start_row + 1 >= len(df):
                break

            time_row = df.iloc[start_row]
            name_row = df.iloc[start_row + 1]

            date_cell = time_row[0]
            if pd.isna(date_cell):
                continue

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

                # 处理每一列的数据
                for col in range(1, 7):
                    time_val = time_row[col]
                    name_val = name_row[col]

                    if not pd.isna(time_val) and not pd.isna(name_val):
                        time_slot = str(time_val).strip()
                        name = str(name_val).strip()
                        if not name or name == 'nan':
                            name = "空"
                        if time_slot and time_slot != 'nan':
                            floor_map = {0: '二层', 2: '三层', 4: '四层'}
                            slot_map = {0: 1, 1: 1, 2: 2, 3: 2, 4: 1, 5: 2}

                            floor = floor_map.get(col - 1, '未知')
                            slot = slot_map.get(col - 1, 1)

                            result[date_str].append({
                                "floor": floor,
                                "time": time_slot,
                                "name": name,
                                "slot": slot
                            })

        return result

    except Exception as e:
        print(f"处理文件 {excel_file} 时出错: {e}")
        return {}

# 加载现有数据
try:
    with open('data/schedule.json', 'r', encoding='utf-8') as f:
        existing_data = json.load(f)
    print(f"加载了现有数据，包含 {len(existing_data)} 天")
except:
    existing_data = {}

# 处理新文件
new_data = process_single_excel('10.09-10.31.xlsx', '2025', '10')
print(f"新文件包含 {len(new_data)} 天")

# 合并数据
for date, entries in new_data.items():
    existing_data[date] = entries

# 按日期排序
sorted_data = dict(sorted(existing_data.items()))

# 保存
with open('data/schedule.json', 'w', encoding='utf-8') as f:
    json.dump(sorted_data, f, ensure_ascii=False, indent=2)

print(f"合并完成！总计 {len(sorted_data)} 天数据")