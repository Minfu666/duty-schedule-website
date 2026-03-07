import pandas as pd
import json
import re
from datetime import datetime

def parse_excel_correctly(excel_file, year="2025", month_prefix=""):
    """同时处理正常结构和合并单元格结构"""
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
            # 合并单元格结构处理
            columns_to_process = [(1, '二层'), (3, '三层'), (5, '四层')]

            for col_idx, floor in columns_to_process:
                if not pd.isna(time_row[col_idx]) and not pd.isna(name_row[col_idx]):
                    time_slot = str(time_row[col_idx]).strip()
                    name = str(name_row[col_idx]).strip()
                    if not name or name == 'nan':
                        name = "空"
                    if time_slot and time_slot != 'nan':
                        result[date_str].append({"floor": floor, "time": time_slot, "name": name})
                        print(f"      添加({floor}): {time_slot} - {name}" if name != "空" else f"      添加({floor}): {time_slot} - 空")

        else:
            print("    🔄 正常单元格结构（每层两个时间段）")
            # 正常结构处理
            columns_to_process = [
                (1, '二层'), (2, '二层'),
                (3, '三层'), (4, '三层'),
                (5, '四层'), (6, '四层')
            ]

            slot_numbers = [1, 1, 2, 2, 3, 3]  # 用于标记时段编号

            for i, (col_idx, floor) in enumerate(columns_to_process):
                if not pd.isna(time_row[col_idx]) and not pd.isna(name_row[col_idx]):
                    time_slot = str(time_row[col_idx]).strip()
                    name = str(name_row[col_idx]).strip()
                    if not name or name == 'nan':
                        name = "空"
                    if time_slot and time_slot != 'nan':
                        slot_num = (i % 2) + 1  # 每层的时段编号
                        result[date_str].append({
                            "floor": floor,
                            "time": time_slot,
                            "name": name,
                            "slot": slot_num
                        })
                        floor_slot = "时段" + str(slot_num)
                        print(f"      添加({floor}-{floor_slot}): {time_slot} - {name}" if name != "空" else f"      添加({floor}-{floor_slot}): {time_slot} - 空")

        processed_days += 1

    print(f"  ✅ 处理了 {processed_days} 天的数据")
    return result

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

    # 保存合并后的数据
    with open('data/schedule.json', 'w', encoding='utf-8') as f:
        json.dump(sorted_data, f, ensure_ascii=False, indent=2)

    print(f"\n🎉 所有数据合并完成！")
    print(f"📅 总计处理了 {len(sorted_data)} 天的数据")

    # 统计信息
    total_entries = sum(len(entries) for entries in sorted_data.values())
    print(f"📊 总值班条目: {total_entries}")

    # 显示日期范围
    if sorted_data:
        dates = list(sorted_data.keys())
        print(f"📅 数据范围: {dates[0]} 至 {dates[-1]}")

    return sorted_data

def create_backup():
    """创建当前数据文件的备份"""
    try:
        import shutil
        from datetime import datetime

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"data/schedule_backup_{timestamp}.json"

        shutil.copy2('data/schedule.json', backup_file)
        print(f"✅ 已创建备份文件: {backup_file}")
        return True
    except Exception as e:
        print(f"❌ 创建备份失败: {e}")
        return False

if __name__ == "__main__":
    print("开始合并所有Excel文件...")

    # 创建备份
    create_backup()

    # 合并所有数据
    merged_data = merge_all_excel_files()

    print("\n数据更新完成！")