import os
import shutil

def before_build_littlefs(source, target, env):
    print("--- VITE: STARTING PRODUCTION BUILD ---")
    # 1. Run Vite build (Generates .gz files in web/dist)
    os.system("cd web && npm run build")
    
    # 2. Clean/Create the actual data folder
    data_dir = "data"
    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
    os.makedirs(data_dir)

    # 3. Copy the Gzipped assets directly
    files_to_copy = ["index.html.gz", "favicon.ico.gz"]
    
    found_any = False
    for f in files_to_copy:
        src_path = os.path.join("web/dist", f)
        if os.path.exists(src_path):
            shutil.copy(src_path, os.path.join(data_dir, f))
            print(f"--- SUCCESS: Moved {f} to /data ---")
            found_any = True
            
    if not found_any:
        print("--- ERROR: No .gz files found in web/dist! ---")

# Register with PlatformIO
Import("env")
env.AddPreAction("$BUILD_DIR/littlefs.bin", before_build_littlefs)

