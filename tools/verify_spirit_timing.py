"""Compatibility entry point for the owned native OBS verification job."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tools.verify_spirit_live import verify

if __name__ == '__main__':
    verify()
