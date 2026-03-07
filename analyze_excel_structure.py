import pandas as pd
import sys

def analyze_excel_structure(excel_file):
    """详细分析Excel文件结构"""
    print(f"分析Excel文件: {excel_file}")
    print("=" * 80)

    try:
        # 读取Excel文件
        df = pd.read_excel(excel_file, header=None)
        print(f"总行数: {len(df)}")
        print(f"总列数: {len(df.columns)}")
        print()

        # 显示前10行的完整结构
        print("前10行数据结构:")
        for i in range(min(10, len(df))):
            row_data = []
            for j in range(min(10, len(df.columns))):
                cell_value = df.iloc[i, j]
                if pd.isna(cell_value):
                    row_data.append("NULL")
                else:
                    row_data.append(str(cell_value)[:15])  # 限制显示长度
            print(f"行{i+1:2d}: {row_data}")
        print()

        # 检查时间列的模式
        print("时间列分析:")
        time_columns = {}
        for col in range(1, min(8, len(df.columns))):
            unique_times = set()
            for row in range(2, min(10, len(df)), 2):  # 只检查时间行
                if not pd.isna(df.iloc[row, col]):
                    unique_times.add(str(df.iloc[row, col]))

            if unique_times:
                time_columns[col] = list(unique_times)[:5]  # 显示前5个
                print(f"  列{chr(65+col)}: {time_columns[col]}")
        print()

        # 检查姓名列的模式
        print("姓名列分析:")
        name_columns = {}
        for col in range(1, min(8, len(df.columns))):
            unique_names = set()
            for row in range(3, min(11, len(df)), 2):  # 只检查姓名行
                if not pd.isna(df.iloc[row, col]):
                    unique_names.add(str(df.iloc[row, col]))

            if unique_names:
                name_columns[col] = list(unique_names)[:5]  # 显示前5个
                print(f"  列{chr(65+col)}: {name_columns[col]}")
        print()

        # 分析数据模式
        print("数据模式分析:")
        date_patterns = {}

        for start_row in range(2, min(12, len(df)), 2):
            if start_row + 1 >= len(df):
                break

            date_cell = df.iloc[start_row, 0]
            if pd.isna(date_cell):
                continue

            # 获取日期
            if isinstance(date_cell, (int, float)):
                date_float = float(date_cell)
                date_str_full = f"{date_float:.2f}"
                integer_part, decimal_part = date_str_full.split('.')
                day = decimal_part.zfill(2)
                date_str = f"day-{day}"
            else:
                date_str = str(date_cell)

            print(f"\n日期行 {start_row+1} ({date_str}):")

            # 检查时间行和姓名行的对应关系
            time_row = df.iloc[start_row]
            name_row = df.iloc[start_row + 1]

            for col in range(1, min(8, len(df.columns))):
                time_val = time_row[col]
                name_val = name_row[col]

                if not pd.isna(time_val) and not pd.isna(name_val):
                    print(f"  列{chr(65+col)}: 时间='{time_val}' -> 姓名='{name_val}'")

                    # 检查是否是合并单元格的标志
                    if col + 1 < len(df.columns):
                        next_time = time_row[col + 1]
                        if pd.isna(next_time):
                            print(f"    -> 可能是合并单元格（下一列为空）")

    except Exception as e:
        print(f"分析Excel文件时出错: {e}")
        return False

    return True

def check_all_excel_files():
    """检查所有Excel文件的结构"""
    excel_files = [
        '6月巡馆.xlsx',
        '9.01-9.07巡馆.xlsx',
        '9.08-9.14.xlsx',
        '9.15-9.30.xlsx',
        '10.09-10.31.xlsx'
    ]

    for excel_file in excel_files:
        try:
            analyze_excel_structure(excel_file)
            print("\n" + "="*80 + "\n")
        except Exception as e:
            print(f"无法处理文件 {excel_file}: {e}\n")

if __name__ == "__main__":
    check_all_excel_files()