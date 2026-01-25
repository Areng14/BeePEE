#!/usr/bin/env python3
"""
MDL Dependency Finder
Uses srctools to extract material dependencies from Source Engine MDL files.

Usage:
    python find_mdl_deps.py <mdl_path> <game_dir> [--search-paths path1;path2;...]

Output:
    JSON object with materials array

Example:
    python find_mdl_deps.py "models/props/cube.mdl" "C:/Steam/steamapps/common/Portal 2/portal2"
"""

import sys
import os
import json
import argparse

try:
    import srctools.game
    import srctools.packlist
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "srctools not installed. Run: pip install srctools"
    }))
    sys.exit(1)


def find_mdl_dependencies(mdl_path, game_dir, extra_paths=None):
    """
    Find all material dependencies for an MDL file using srctools.

    Args:
        mdl_path: Path to the MDL file (can be relative like "models/props/cube.mdl")
        game_dir: Path to the game directory (e.g., Portal 2/portal2)
        extra_paths: Additional search paths

    Returns:
        dict with success status and materials list
    """
    try:
        # Normalize the MDL path
        mdl_path = mdl_path.replace("\\", "/").lower()
        if not mdl_path.startswith("models/"):
            mdl_path = "models/" + mdl_path
        if not mdl_path.endswith(".mdl"):
            mdl_path = mdl_path + ".mdl"

        # Create Game object and get filesystem
        game = srctools.game.Game(game_dir)
        fsys = game.get_filesystem()

        # Add extra search paths to filesystem
        if extra_paths:
            from srctools.filesys import RawFileSystem, VPKFileSystem
            for path in extra_paths:
                if os.path.exists(path):
                    if path.endswith(".vpk"):
                        try:
                            fsys.add_sys(VPKFileSystem(path))
                        except Exception:
                            pass
                    else:
                        fsys.add_sys(RawFileSystem(path))

        # Create PackList and find dependencies
        packlist = srctools.packlist.PackList(fsys)
        packlist.pack_file(mdl_path)
        packlist.eval_dependencies()  # This is the key call!

        # Extract materials from the pack list
        materials = []
        models = []
        other = []

        for file_path in packlist._files:
            file_lower = file_path.lower()
            if file_lower.startswith("materials/"):
                # Return without extension
                mat_path = os.path.splitext(file_lower)[0]
                if mat_path not in materials:
                    materials.append(file_lower)  # Keep full path with extension
            elif file_lower.startswith("models/"):
                if file_lower not in models:
                    models.append(file_lower)
            else:
                if file_lower not in other:
                    other.append(file_lower)

        return {
            "success": True,
            "mdlPath": mdl_path,
            "materials": sorted(materials),
            "models": sorted(models),
            "other": sorted(other),
            "totalDependencies": len(materials) + len(models) + len(other)
        }

    except FileNotFoundError as e:
        return {
            "success": False,
            "error": f"File not found: {str(e)}",
            "mdlPath": mdl_path
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "mdlPath": mdl_path
        }


def main():
    parser = argparse.ArgumentParser(
        description="Find material dependencies for Source Engine MDL files"
    )
    parser.add_argument("mdl_path", help="Path to the MDL file")
    parser.add_argument("game_dir", help="Path to the game directory (e.g., Portal 2/portal2)")
    parser.add_argument(
        "--search-paths",
        help="Additional search paths (semicolon-separated)",
        default=""
    )

    args = parser.parse_args()

    # Parse extra paths
    extra_paths = None
    if args.search_paths:
        extra_paths = [p.strip() for p in args.search_paths.split(";") if p.strip()]

    # Find dependencies
    result = find_mdl_dependencies(args.mdl_path, args.game_dir, extra_paths)

    # Output as JSON
    print(json.dumps(result, indent=2))

    # Exit with error code if failed
    if not result.get("success"):
        sys.exit(1)


if __name__ == "__main__":
    main()
