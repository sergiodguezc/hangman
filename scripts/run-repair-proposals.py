#!/usr/bin/env python3
from vocab_pipeline import main

if __name__ == "__main__":
    import sys
    sys.argv.insert(1, "repair-propose")
    main()
