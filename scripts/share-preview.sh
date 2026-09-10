#!/usr/bin/env bash
# Keep a public link to the local preview alive.
#
#   bash scripts/share-preview.sh
#
# localhost.run only accepts SSH keys that were registered with them, so this
# uses their anonymous tunnel. Anonymous tunnels get a NEW address every time
# they reconnect, so every time one comes up the address is printed in a box and
# written to .preview-url.txt next to the project. Stop with Ctrl+C.

set -u
PORT="${PORT:-8087}"
HERE="$(cd "$(dirname "$0")" && pwd)"
URLFILE="${URLFILE:-$HERE/../.preview-url.txt}"

command -v ssh >/dev/null || { echo "找不到 ssh"; exit 1; }

if ! curl -s -o /dev/null --max-time 5 "http://localhost:${PORT}/"; then
  echo "本机预览服务没在 ${PORT} 端口运行。先在另一个窗口执行："
  echo "    python scripts/preview-server.py --port ${PORT}"
  exit 1
fi

echo "按 Ctrl+C 结束。断线会自动重连；重连后地址会变，以下方框内始终是当前地址。"
echo

trap 'echo; echo "已停止。"; exit 0' INT TERM

while true; do
  echo "--- $(date "+%H:%M:%S") 正在连接 ---"
  ssh -o StrictHostKeyChecking=accept-new \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -R "80:localhost:${PORT}" nokey@localhost.run 2>&1 \
  | while IFS= read -r line; do
      url=$(printf '%s' "$line" | grep -oE 'https://[a-z0-9]+\.lhr\.life' | head -1)
      if [ -n "$url" ]; then
        printf '%s\n' "$url" > "$URLFILE"
        echo
        echo "  +------------------------------------------------------+"
        printf "  |  当前地址  %-42s|\n" "$url"
        echo   "  |  用户名    phai                                      |"
        echo "  +------------------------------------------------------+"
        echo
      fi
    done
  echo "--- 连接断开，5 秒后重连（地址会变，见上方方框）---"
  sleep 5
done
