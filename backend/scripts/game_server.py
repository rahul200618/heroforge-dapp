"""Simulated game server for the demo. Calls the backend's game-master endpoints.

Run from inside backend/ (it reads MATCH_API_KEY from backend/.env):

  python scripts/game_server.py match --char 1 --xp 20                 # grant XP after a match
  python scripts/game_server.py match --char 1 --xp 20 --match-id m1   # run twice: second call returns 409
  python scripts/game_server.py match --char 1 --xp 20 --bad-key      # returns 401, nothing is sent
  python scripts/game_server.py item --to 0xPLAYER --type sword        # grant a loot item
"""
import argparse
import json
import sys
import uuid
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.config import get_settings  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", default="http://localhost:8000")
    p.add_argument("--bad-key", action="store_true", help="send a wrong API key on purpose")
    sub = p.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("match")
    m.add_argument("--char", type=int, required=True)
    m.add_argument("--xp", type=int, required=True)
    m.add_argument("--match-id", default=None)
    i = sub.add_parser("item")
    i.add_argument("--to", required=True)
    i.add_argument("--type", default="sword")
    a = p.parse_args()

    key = "wrong-key" if a.bad_key else get_settings().match_api_key.get_secret_value()
    headers = {"X-API-Key": key}
    if a.cmd == "match":
        body = {"matchId": a.match_id or f"match-{uuid.uuid4().hex[:8]}", "charId": a.char, "xp": a.xp}
        r = requests.post(f"{a.url}/api/match/complete", json=body, headers=headers, timeout=60)
    else:
        body = {"to": a.to, "itemType": a.type}
        r = requests.post(f"{a.url}/api/items/grant", json=body, headers=headers, timeout=60)
    print(f"POST {r.url}\n  request : {json.dumps(body)}\n  status  : {r.status_code}\n  response: {r.text}")


if __name__ == "__main__":
    main()
