import sys
import os
from pathlib import Path

# Add src/srp to sys.path
srp_root = Path(__file__).parent.parent
sys.path.insert(0, str(srp_root / "src" / "srp"))
