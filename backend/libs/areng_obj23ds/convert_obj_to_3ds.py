#!/usr/bin/env python3
"""
OBJ to 3DS Converter - No External Dependencies
Converts OBJ files to 3DS format for Portal 2 Puzzle Maker collision models

Usage:
    python convert_obj_to_3ds.py input.obj output.3ds [scale] [roll] [pitch] [yaw]

Arguments:
    input.obj  - Path to input OBJ file
    output.3ds - Path to output 3DS file  
    scale      - Optional scale factor (default: 1.0, use 0.8-0.9 for smaller collision)
    roll       - Optional roll rotation in degrees around X-axis (default: 0)
    pitch      - Optional pitch rotation in degrees around Y-axis (default: 0)
    yaw        - Optional yaw rotation in degrees around Z-axis (default: 0)

Requirements:
    None - uses only Python standard library
"""

import sys
import os
import struct
import math


def rotate_vertex(x, y, z, roll=0.0, pitch=0.0, yaw=0.0):
    """
    Apply rotation to a vertex using Euler angles (in degrees)
    Roll: rotation around X-axis
    Pitch: rotation around Y-axis  
    Yaw: rotation around Z-axis
    """
    # Convert degrees to radians
    roll_rad = math.radians(roll)
    pitch_rad = math.radians(pitch)
    yaw_rad = math.radians(yaw)
    
    # Roll rotation (around X-axis)
    cos_roll = math.cos(roll_rad)
    sin_roll = math.sin(roll_rad)
    y_rolled = y * cos_roll - z * sin_roll
    z_rolled = y * sin_roll + z * cos_roll
    
    # Pitch rotation (around Y-axis)
    cos_pitch = math.cos(pitch_rad)
    sin_pitch = math.sin(pitch_rad)
    x_pitched = x * cos_pitch + z_rolled * sin_pitch
    z_pitched = -x * sin_pitch + z_rolled * cos_pitch
    
    # Yaw rotation (around Z-axis)
    cos_yaw = math.cos(yaw_rad)
    sin_yaw = math.sin(yaw_rad)
    x_final = x_pitched * cos_yaw - y_rolled * sin_yaw
    y_final = x_pitched * sin_yaw + y_rolled * cos_yaw
    
    return x_final, y_final, z_pitched


def parse_obj_file(obj_path, scale=1.0, roll=0.0, pitch=0.0, yaw=0.0):
    """
    Parse an OBJ file and extract vertices and faces.
    Returns a tuple of (vertices, faces) where:
    - vertices is a list of [x, y, z] coordinates
    - faces is a list of [v1, v2, v3] vertex indices
    - scale: scale factor to apply to vertices (default: 1.0)
    - roll: roll rotation in degrees around X-axis (default: 0)
    - pitch: pitch rotation in degrees around Y-axis (default: 0)
    - yaw: yaw rotation in degrees around Z-axis (default: 0)
    """
    vertices = []
    faces = []

    print(f"Parsing OBJ file: {obj_path}")

    with open(obj_path, 'r') as f:
        for line in f:
            line = line.strip()

            if line.startswith('v '):
                # Vertex line: v x y z [w]
                parts = line.split()
                if len(parts) >= 4:
                    x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
                    # Apply scale factor to vertices
                    x_scaled, y_scaled, z_scaled = x * scale, y * scale, z * scale
                    # Apply rotation
                    x_rotated, y_rotated, z_rotated = rotate_vertex(x_scaled, y_scaled, z_scaled, roll, pitch, yaw)
                    vertices.append([x_rotated, y_rotated, z_rotated])

            elif line.startswith('f '):
                # Face line: f v1[/vt1][/vn1] v2[/vt2][/vn2] v3[/vt3][/vn3] ...
                parts = line.split()[1:]  # Skip 'f'

                # Extract vertex indices (OBJ uses 1-based indexing)
                vertex_indices = []
                for part in parts:
                    # Handle formats like "v", "v/vt", "v/vt/vn", "v//vn"
                    vertex_index = int(part.split('/')[0]) - 1  # Convert to 0-based
                    vertex_indices.append(vertex_index)

                # Triangulate if face has more than 3 vertices (fan triangulation)
                if len(vertex_indices) == 3:
                    faces.append(vertex_indices)
                elif len(vertex_indices) > 3:
                    # Fan triangulation: split polygon into triangles
                    for i in range(1, len(vertex_indices) - 1):
                        faces.append([
                            vertex_indices[0],
                            vertex_indices[i],
                            vertex_indices[i + 1]
                        ])

    print(f"  Loaded {len(vertices)} vertices")
    print(f"  Loaded {len(faces)} faces")

    if not vertices:
        raise ValueError("No vertices found in OBJ file")
    if not faces:
        raise ValueError("No faces found in OBJ file")

    return vertices, faces


def write_3ds_file(vertices, faces, output_path):
    """
    Write vertices and faces to a 3DS file.

    3DS File Format Structure:
    - Main Chunk (0x4D4D)
      - 3D Editor Chunk (0x3D3D)
        - Object Block (0x4000)
          - Triangular Mesh (0x4100)
            - Vertices List (0x4110)
            - Faces List (0x4120)
    """

    print(f"Writing 3DS file: {output_path}")
    print(f"  Vertices: {len(vertices)}")
    print(f"  Faces: {len(faces)}")

    with open(output_path, 'wb') as f:
        # Build vertex data chunk (0x4110)
        vertex_data = struct.pack('<H', len(vertices))  # Number of vertices
        for vertex in vertices:
            vertex_data += struct.pack('<fff', float(vertex[0]), float(vertex[1]), float(vertex[2]))

        # Build face data chunk (0x4120)
        face_data = struct.pack('<H', len(faces))  # Number of faces
        for face in faces:
            # Each face: 3 vertex indices + flags (set to 0)
            face_data += struct.pack('<HHH', int(face[0]), int(face[1]), int(face[2]))
            face_data += struct.pack('<H', 0)  # Face flags

        # Build triangular mesh chunk (0x4100)
        trimesh_data = b''
        # Vertex list chunk
        vertex_chunk_length = 6 + len(vertex_data)
        trimesh_data += struct.pack('<H', 0x4110)  # Vertex list chunk ID
        trimesh_data += struct.pack('<I', vertex_chunk_length)
        trimesh_data += vertex_data

        # Face list chunk
        face_chunk_length = 6 + len(face_data)
        trimesh_data += struct.pack('<H', 0x4120)  # Face list chunk ID
        trimesh_data += struct.pack('<I', face_chunk_length)
        trimesh_data += face_data

        # Build object block chunk (0x4000)
        object_name = b'collision\x00'  # Object name (null-terminated)
        object_data = object_name

        # Triangular mesh chunk
        trimesh_chunk_length = 6 + len(trimesh_data)
        object_data += struct.pack('<H', 0x4100)  # Triangular mesh chunk ID
        object_data += struct.pack('<I', trimesh_chunk_length)
        object_data += trimesh_data

        # Build 3D editor chunk (0x3D3D)
        editor_data = b''
        object_chunk_length = 6 + len(object_data)
        editor_data += struct.pack('<H', 0x4000)  # Object block chunk ID
        editor_data += struct.pack('<I', object_chunk_length)
        editor_data += object_data

        # Build main chunk (0x4D4D)
        editor_chunk_length = 6 + len(editor_data)
        main_data = struct.pack('<H', 0x3D3D)  # 3D Editor chunk ID
        main_data += struct.pack('<I', editor_chunk_length)
        main_data += editor_data

        # Write main chunk
        main_chunk_length = 6 + len(main_data)
        f.write(struct.pack('<H', 0x4D4D))  # Main chunk ID
        f.write(struct.pack('<I', main_chunk_length))
        f.write(main_data)

    print(f"  3DS file written successfully")


def convert_obj_to_3ds(input_path, output_path, scale=1.0, roll=0.0, pitch=0.0, yaw=0.0):
    """
    Convert an OBJ file to 3DS format

    Args:
        input_path: Path to input OBJ file
        output_path: Path to output 3DS file
        scale: Scale factor to apply to vertices (default: 1.0)
        roll: Roll rotation in degrees around X-axis (default: 0)
        pitch: Pitch rotation in degrees around Y-axis (default: 0)
        yaw: Yaw rotation in degrees around Z-axis (default: 0)
    """
    print(f"Converting {input_path} to {output_path}...")
    if scale != 1.0:
        print(f"  Applying scale factor: {scale}")
    if roll != 0 or pitch != 0 or yaw != 0:
        print(f"  Applying rotation: roll={roll}deg, pitch={pitch}deg, yaw={yaw}deg")

    # Parse OBJ file
    try:
        vertices, faces = parse_obj_file(input_path, scale, roll, pitch, yaw)
    except Exception as e:
        print(f"ERROR: Failed to parse OBJ file: {e}")
        sys.exit(1)

    # Write 3DS file
    try:
        write_3ds_file(vertices, faces, output_path)
    except Exception as e:
        print(f"ERROR: Failed to write 3DS file: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Verify output file was created
    if os.path.exists(output_path):
        file_size = os.path.getsize(output_path)
        print(f"SUCCESS: 3DS file created ({file_size} bytes)")
        print(f"Output: {output_path}")
    else:
        print("ERROR: 3DS file was not created")
        sys.exit(1)


def main():
    """Parse command line arguments and run conversion"""
    if len(sys.argv) < 3:
        print("ERROR: Missing arguments")
        print("Usage: python convert_obj_to_3ds.py input.obj output.3ds [scale] [roll] [pitch] [yaw]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    # Parse optional parameters
    scale = 1.0
    roll = 0
    pitch = 0
    yaw = 0
    
    if len(sys.argv) >= 4:
        try:
            scale = float(sys.argv[3])
            if scale <= 0:
                print("ERROR: Scale factor must be positive")
                sys.exit(1)
        except ValueError:
            print("ERROR: Scale factor must be a number")
            sys.exit(1)
    
    if len(sys.argv) >= 5:
        try:
            roll = float(sys.argv[4])
        except ValueError:
            print("ERROR: Roll rotation must be a number")
            sys.exit(1)
    
    if len(sys.argv) >= 6:
        try:
            pitch = float(sys.argv[5])
        except ValueError:
            print("ERROR: Pitch rotation must be a number")
            sys.exit(1)
    
    if len(sys.argv) >= 7:
        try:
            yaw = float(sys.argv[6])
        except ValueError:
            print("ERROR: Yaw rotation must be a number")
            sys.exit(1)

    # Validate input file exists
    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)

    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    # Run conversion
    convert_obj_to_3ds(input_path, output_path, scale, roll, pitch, yaw)


if __name__ == "__main__":
    main()
