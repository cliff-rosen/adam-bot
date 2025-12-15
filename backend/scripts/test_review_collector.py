"""
Test script for the Review Collector Agent.

Run with: python -m scripts.test_review_collector
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.builtin.review_collector import execute_review_collector


class MockDB:
    pass


def test_business(name: str, location: str):
    print(f"\n{'='*60}")
    print(f"TESTING: {name} ({location})")
    print(f"{'='*60}")

    params = {"business_name": name, "location": location}
    context = {}

    generator = execute_review_collector(params, MockDB(), 1, context)

    result = None
    try:
        while True:
            item = next(generator)
            if hasattr(item, 'stage'):
                print(f"[{item.stage}] {item.message}")
    except StopIteration as e:
        result = e.value

    if result:
        print(f"\n{'='*40}")
        print("RESULT:")
        print(f"{'='*40}")
        print(result.text)

    return result


def main():
    print("Review Collector Agent Test")
    print("="*60)
    print("Using existing agent_loop infrastructure")
    print("="*60)

    test_business("Cambridge Endodontics", "Cambridge, MA")


if __name__ == "__main__":
    main()
