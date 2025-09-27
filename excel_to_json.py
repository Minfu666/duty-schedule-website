import pandas as pd
import json
import re

def parse_excel_correctly(excel_file, output_json):
    """同时处理正常结构和合并单元格结构"""
    df = pd.read_excel(excel_file, header=None)
    
    result = {}
    year = "2025"
    month = "09"
    
    print(f"Excel总行数: {len(df)}")
    
    # 从第3行开始，每2行处理一组数据
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
        
        print(f"📅 处理日期: {date_str} (第{start_row+1}行)")
        
        if date_str not in result:
            result[date_str] = []
        
        # 检测结构类型：检查是否是合并单元格
        is_merged_structure = (
            not pd.isna(time_row[1]) and pd.isna(time_row[2]) and  # B列有值，C列为空
            not pd.isna(time_row[3]) and pd.isna(time_row[4]) and  # D列有值，E列为空
            not pd.isna(time_row[5]) and pd.isna(time_row[6])      # F列有值，G列为空
        )
        
        if is_merged_structure:
            print("  🔄 检测到合并单元格结构（每层一个时间段）")
            # 合并单元格结构：每层只有一个时间段和一个人名
            # B列: 二层时间 | D列: 三层时间 | F列: 四层时间
            # B列下一行: 二层人名 | D列下一行: 三层人名 | F列下一行: 四层人名
            
            # 处理二层
            if not pd.isna(time_row[1]) and not pd.isna(name_row[1]):
                time_slot = str(time_row[1]).strip()
                name = str(name_row[1]).strip()
                if not name: name = "空"
                if time_slot:
                    result[date_str].append({"floor": "二层", "time": time_slot, "name": name})
                    print(f"  添加(二层): {time_slot} - {name}" if name != "空" else f"  添加(二层): {time_slot} - 空")
            
            # 处理三层
            if not pd.isna(time_row[3]) and not pd.isna(name_row[3]):
                time_slot = str(time_row[3]).strip()
                name = str(name_row[3]).strip()
                if not name: name = "空"
                if time_slot:
                    result[date_str].append({"floor": "三层", "time": time_slot, "name": name})
                    print(f"  添加(三层): {time_slot} - {name}" if name != "空" else f"  添加(三层): {time_slot} - 空")
            
            # 处理四层
            if not pd.isna(time_row[5]) and not pd.isna(name_row[5]):
                time_slot = str(time_row[5]).strip()
                name = str(name_row[5]).strip()
                if not name: name = "空"
                if time_slot:
                    result[date_str].append({"floor": "四层", "time": time_slot, "name": name})
                    print(f"  添加(四层): {time_slot} - {name}" if name != "空" else f"  添加(四层): {time_slot} - 空")
                    
        else:
            print("  🔄 正常单元格结构（每层两个时间段）")
            # 正常结构：每层有两个时间段和两个人名
            # B列: 二层时间1 | C列: 二层时间2
            # D列: 三层时间1 | E列: 三层时间2
            # F列: 四层时间1 | G列: 四层时间2
            
            # 处理二层（两个时间段）
            if not pd.isna(time_row[1]) and not pd.isna(name_row[1]):
                time_slot = str(time_row[1]).strip()
                name = str(name_row[1]).strip()
                if not name: name = "空"
                if time_slot:
                    result[date_str].append({"floor": "二层", "time": time_slot, "name": name})
                    print(f"  添加(二层-时段1): {time_slot} - {name}" if name != "空" else f"  添加(二层-时段1): {time_slot} - 空")
            
            if not pd.isna(time_row[2]) and not pd.isna(name_row[2]):
                time_slot = str(time_row[2]).strip()
                name = str(name_row[2]).strip()
                if not name: name = "空"
                if time_slot:
                    result[date_str].append({"floor": "二层", "time": time_slot, "name": name})
                    print(f"  添加(二层-时段2): {time_slot} - {name}" if name != "空" else f"  添加(二层-时段2): {time_slot} - 空")
            
            # 处理三层（两个时间段）
            if not pd.isna(time_row[3]) and not pd.isna(name_row[3]):
                time_slot = str(time_row[3]).strip()
                name = str(name_row[3]).strip()
                if not name: name = "空"
                if time_slot:
                    result[date_str].append({"floor": "三层", "time": time_slot, "name": name})
                    print(f"  添加(三层-时段1): {time_slot} - {name}" if name != "空" else f"  添加(三层-时段1): {time_slot} - 空")
            
            if not pd.isna(time_row[4]) and not pd.isna(name_row[4]):
                time_slot = str(time_row[4]).strip()
                name = str(name_row[4]).strip()
                if not name: name = "空"
                if time_slot:
                    result[date_str].append({"floor": "三层", "time": time_slot, "name": name})
                    print(f"  添加(三层-时段2): {time_slot} - {name}" if name != "空" else f"  添加(三层-时段2): {time_slot} - 空")
            
            # 处理四层（两个时间段）
            if not pd.isna(time_row[5]) and not pd.isna(name_row[5]):
                time_slot = str(time_row[5]).strip()
                name = str(name_row[5]).strip()
                if not name: name = "空"
                if time_slot:
                    result[date_str].append({"floor": "四层", "time": time_slot, "name": name})
                    print(f"  添加(四层-时段1): {time_slot} - {name}" if name != "空" else f"  添加(四层-时段1): {time_slot} - 空")
            
            if not pd.isna(time_row[6]) and not pd.isna(name_row[6]):
                time_slot = str(time_row[6]).strip()
                name = str(name_row[6]).strip()
                if not name: name = "空"
                if time_slot:
                    result[date_str].append({"floor": "四层", "time": time_slot, "name": name})
                    print(f"  添加(四层-时段2): {time_slot} - {name}" if name != "空" else f"  添加(四层-时段2): {time_slot} - 空")
    
    # 保存为JSON文件
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 转换完成！已保存到 {output_json}")
    print(f"📅 共处理了 {len(result)} 天的数据")
    
    # 显示统计信息
    total_entries = sum(len(entries) for entries in result.values())
    print(f"📊 总值班条目: {total_entries}")
    
    # 显示每种结构处理的天数
    normal_days = 0
    merged_days = 0
    for date, entries in result.items():
        if len(entries) == 3:  # 合并结构：每层1个，共3个
            merged_days += 1
        elif len(entries) == 6:  # 正常结构：每层2个，共6个
            normal_days += 1
    
    print(f"📈 正常结构天数: {normal_days}")
    print(f"📈 合并结构天数: {merged_days}")

# 使用示例
if __name__ == "__main__":
    parse_excel_correctly('9.15-9.30.xlsx', 'data/schedule.json')
