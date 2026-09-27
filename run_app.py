import subprocess
import sys
import os
import time

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")
    venv_python = os.path.join(root_dir, "venv", "Scripts", "python.exe") if os.name == 'nt' else os.path.join(root_dir, "venv", "bin", "python")
    
    print("==================================================")
    print("Launching AI-Powered Meeting MoM Web Application")
    print("==================================================")
    print("Backend API:  http://localhost:8000")
    print("API Docs:     http://localhost:8000/docs")
    print("Frontend UI:  http://localhost:5173")
    print("==================================================")

    # Start FastAPI Backend
    backend_cmd = [
        venv_python if os.path.exists(venv_python) else sys.executable,
        "-m", "uvicorn", "backend.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload"
    ]
    
    backend_proc = subprocess.Popen(backend_cmd, cwd=root_dir)

    # Start Vite Frontend Dev Server
    npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
    frontend_proc = subprocess.Popen([npm_cmd, "run", "dev", "--", "--host"], cwd=frontend_dir)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        backend_proc.terminate()
        frontend_proc.terminate()

if __name__ == "__main__":
    main()
