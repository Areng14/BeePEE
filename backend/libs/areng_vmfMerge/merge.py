#!/usr/bin/env python3
"""
VMF Grid Merger - Merge multiple VMF files into a grid layout
Uses srctools for proper VMF parsing and manipulation
"""
import sys
import json
import math
from pathlib import Path
from srctools import Vec, VMF


def calculate_grid_dimensions(count):
    """Calculate grid dimensions to make it roughly square"""
    cols = math.ceil(math.sqrt(count))
    rows = math.ceil(count / cols)
    return cols, rows


def get_vmf_bounds(vmf):
    """Get bounding box of a VMF file"""
    min_x = min_y = min_z = float('inf')
    max_x = max_y = max_z = float('-inf')
    
    # Check all brushes (they're on worldspawn and brush entities)
    for brush in vmf.brushes:
        # Get all vertices from brush sides
        for side in brush.sides:
            # side.planes is a tuple of 3 points
            for point in side.planes:
                min_x = min(min_x, point.x)
                max_x = max(max_x, point.x)
                min_y = min(min_y, point.y)
                max_y = max(max_y, point.y)
                min_z = min(min_z, point.z)
                max_z = max(max_z, point.z)
    
    # Check all entities with origin
    for ent in vmf.entities:
        origin_str = ent.get('origin', None)
        if origin_str:
            try:
                origin = Vec.from_str(origin_str)
                min_x = min(min_x, origin.x)
                max_x = max(max_x, origin.x)
                min_y = min(min_y, origin.y)
                max_y = max(max_y, origin.y)
                min_z = min(min_z, origin.z)
                max_z = max(max_z, origin.z)
            except:
                pass
    
    # Default bounds if nothing found
    if not math.isfinite(min_x):
        return 0, 128, 0, 128, 0, 128
    
    return min_x, max_x, min_y, max_y, min_z, max_z


def offset_vmf(vmf, offset):
    """
    Offset all coordinates in a VMF by the given vector
    Uses srctools built-in translate which properly handles texture locking
    """
    # Offset all brushes - srctools has built-in translate with texture lock
    for brush in vmf.brushes:
        brush.translate(offset)
    
    # Offset entities with origin
    for ent in vmf.entities:
        origin_str = ent.get('origin', None)
        if origin_str:
            try:
                origin = Vec.from_str(origin_str)
                ent['origin'] = str(origin + offset)
            except:
                pass


def merge_vmfs_grid(vmf_paths, output_path, spacing=256):
    """
    Merge multiple VMF files into a grid layout
    
    Args:
        vmf_paths: List of VMF file paths to merge
        output_path: Output path for merged VMF
        spacing: Spacing between models in units
    """
    print(f"Merging {len(vmf_paths)} VMF files into grid layout...")
    
    # Load all VMFs and get their bounds
    vmf_data = []
    max_width = max_height = max_depth = 0
    
    for vmf_path in vmf_paths:
        print(f"  Loading: {vmf_path}")
        vmf = VMF.parse(Path(vmf_path))  # pyright: ignore[reportArgumentType]
        
        min_x, max_x, min_y, max_y, min_z, max_z = get_vmf_bounds(vmf)
        width = max_x - min_x
        height = max_y - min_y
        depth = max_z - min_z
        
        max_width = max(max_width, width)
        max_height = max(max_height, height)
        max_depth = max(max_depth, depth)
        
        vmf_data.append({
            'vmf': vmf,
            'path': vmf_path,
            'bounds': (min_x, max_x, min_y, max_y, min_z, max_z),
            'size': (width, height, depth)
        })
        
        print(f"    Size: {width:.0f}x{height:.0f}x{depth:.0f}")
    
    # Calculate grid layout with square cells
    cols, rows = calculate_grid_dimensions(len(vmf_data))
    max_dimension = max(max_width, max_height, max_depth)
    cell_size = max_dimension + spacing
    
    print(f"  Grid: {cols}x{rows}, Cell size: {cell_size:.0f} (square)")
    
    # Create merged VMF (use first as base, but clear it)
    merged_vmf = vmf_data[0]['vmf']
    merged_vmf.brushes.clear()
    merged_vmf.entities.clear()
    
    # Merge each VMF with offset
    grid_layout = []
    
    for i, data in enumerate(vmf_data):
        col = i % cols
        row = i // cols
        
        # Calculate grid position
        grid_x = col * cell_size
        grid_y = row * cell_size
        grid_z = 0
        
        # Center model in its cell by offsetting from its bounds
        min_x, max_x, min_y, max_y, min_z, max_z = data['bounds']
        model_center_x = (min_x + max_x) / 2
        model_center_y = (min_y + max_y) / 2
        
        # Calculate cell center
        cell_center_x = grid_x + cell_size / 2
        cell_center_y = grid_y + cell_size / 2
        
        # Offset to center the model in the cell (X/Y only, Z unchanged)
        offset_x = cell_center_x - model_center_x
        offset_y = cell_center_y - model_center_y
        offset_z = 0  # Do NOT modify height
        
        offset_vec = Vec(offset_x, offset_y, offset_z)
        
        print(f"  Placing {Path(data['path']).stem} at ({col}, {row}) -> offset ({offset_x:.0f}, {offset_y:.0f}, {offset_z:.0f})")
        
        # Load VMF fresh (don't reuse the cached one to avoid modifying shared objects)
        vmf = VMF.parse(Path(data['path']))  # pyright: ignore[reportArgumentType]
        offset_vmf(vmf, offset_vec)
        
        # Merge brushes
        for brush in vmf.brushes:
            merged_vmf.brushes.append(brush)
        
        # Merge entities
        for ent in vmf.entities:
            merged_vmf.entities.append(ent)
        
        # Store grid info with final bounds after offsetting
        grid_layout.append({
            'name': Path(data['path']).stem,
            'index': i,
            'col': col,
            'row': row,
            'offsetX': offset_x,
            'offsetY': offset_y,
            'offsetZ': offset_z,
            'cellX': grid_x,
            'cellY': grid_y,
            'bounds': {
                'minX': min_x + offset_x,
                'maxX': max_x + offset_x,
                'minY': min_y + offset_y,
                'maxY': max_y + offset_y,
                'minZ': min_z + offset_z,
                'maxZ': max_z + offset_z
            }
        })
    
    # Write merged VMF
    with open(output_path, 'w') as f:
        merged_vmf.export(f)
    
    print(f"[OK] Merged VMF saved to: {output_path}")
    
    # Write grid layout JSON for later splitting
    layout_path = output_path.replace('.vmf', '_layout.json')
    with open(layout_path, 'w') as f:
        json.dump({
            'cols': cols,
            'rows': rows,
            'cellSize': cell_size,
            'layout': grid_layout
        }, f, indent=2)
    
    print(f"[OK] Grid layout saved to: {layout_path}")
    
    return {
        'success': True,
        'output': output_path,
        'layout': layout_path,
        'cols': cols,
        'rows': rows,
        'cellSize': cell_size
    }


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: merge.py <output.vmf> <input1.vmf> <input2.vmf> ...")
        print("       merge.py --json <config.json>")
        sys.exit(1)
    
    # JSON config mode
    if sys.argv[1] == '--json':
        with open(sys.argv[2], 'r') as f:
            config = json.load(f)
        
        result = merge_vmfs_grid(
            config['inputs'],
            config['output'],
            config.get('spacing', 384)
        )
        
        # Output result as JSON
        print(json.dumps(result))
    
    # Command-line mode
    else:
        output_path = sys.argv[1]
        input_paths = sys.argv[2:]
        
        result = merge_vmfs_grid(input_paths, output_path)
        print(json.dumps(result))