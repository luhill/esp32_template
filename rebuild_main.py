Import("env")
import os

def force_check():
    # 1. Get the current environment's header name from platformio.ini
    header_var = env.GetProjectOption("custom_header_name", "")
    if not header_var:
        return

    # 2. Define the paths (Now pointing to src/devices)
    src_dir = env.subst("$PROJECT_SRC_DIR")
    # Join src/devices/your_header.h
    header_path = os.path.join(src_dir, "devices", f"{header_var}.h")
    main_path = os.path.join(src_dir, "main.cpp")

    # 3. Check if both exist
    if os.path.exists(header_path) and os.path.exists(main_path):
        h_stat = os.stat(header_path)
        m_stat = os.stat(main_path)

        # 4. If Header is newer than Main (or same time), touch Main
        if h_stat.st_mtime >= m_stat.st_mtime:
            os.utime(main_path, None)
            print(f"--- [REBUILD_MAIN] Change in devices/{header_var}.h -> Touching main.cpp ---")
            
    # 5. Explicitly tell SCons (the build engine) about this relationship
    # This is the "Double-Lock" to ensure firmware.bin actually updates
    env.Depends("$BUILD_DIR/src/main.cpp.o", header_path)

# Execute immediately on load
force_check()