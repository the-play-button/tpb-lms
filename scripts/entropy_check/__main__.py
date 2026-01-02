#!/usr/bin/env python3
"""
Entry point for entropy_check module.

Usage:
    python -m entropy_check [--path PATH] [--report] [--verbose]
    python scripts/entropy_check [--path PATH] [--report] [--verbose]
"""

import argparse
import sys
from pathlib import Path

from . import EntropyChecker


def main():
    parser = argparse.ArgumentParser(description='TPB Entropy Check')
    parser.add_argument('--path', type=str, default='.', help='Path to analyze')
    parser.add_argument('--report', action='store_true', help='Generate markdown report')
    parser.add_argument('--output', type=str, help='Output file for report')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    root = Path(args.path).resolve()
    
    if not root.exists():
        print(f"❌ Path not found: {root}")
        sys.exit(1)
    
    checker = EntropyChecker(root, verbose=args.verbose)
    passed = checker.run_all_checks()
    
    if args.report:
        report = checker.get_report()
        if args.output:
            Path(args.output).write_text(report)
            print(f"\n📄 Report written to: {args.output}")
        else:
            print("\n" + report)
    else:
        checker.print_summary()
    
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()
