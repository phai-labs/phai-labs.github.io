#!/usr/bin/env bash
# Keep a public link to the local preview alive.
#
#   bash scripts/share-preview.sh
#
# Connects with your SSH key, so localhost.run gives the SAME address every time
# instead of a new random one, and reconnects by itself when the free tunnel is
# dropped. Stop it with Ctrl+C.

set -u
PORT="${PORT:-8087}"

command -v ssh >/dev/null || { echo "找不到 ssh"; exit 1; }

if ! curl -s -o /dev/null --max-time 5 "http://localhost:${PORT}/"; then
  echo "本机预览服务没在 ${PORT} 端口运行。先在另一个窗口执行："
  echo "    python scripts/preview-server.py --port ${PORT}"
  exit 1
fi

KEY=""
for k in "$HOME/.ssh/id_ed25519" "$HOME/.ssh/id_rsa"; do
  [ -f "$k" ] && { KEY="$k"; break; }
done

if [ -n "$KEY" ]; then
  echo "使用密钥 $KEY 连接（地址固定，断线重连不变）"
  SSH_TARGET="localhost.run"
  KEY_OPTS=(-i "$KEY" -o IdentitiesOnly=yes -o PubkeyAcceptedKeyTypes=+ssh-rsa -o HostKeyAlgorithms=+ssh-rsa)
else
  echo "没有找到 SSH 密钥，改用匿名连接（每次重连地址都会变）"
  SSH_TARGET="nokey@localhost.run"
  KEY_OPTS=()
fi

echo "按 Ctrl+C 结束。断线会自动重连。"
echo

trap 'echo; echo "已停止。"; exit 0' INT TERM

while true; do
  echo "--- $(date "+%H:%M:%S") 正在连接 ---"
  ssh -o StrictHostKeyChecking=accept-new \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      "${KEY_OPTS[@]}" \
      -R "80:localhost:${PORT}" "$SSH_TARGET"
  code=$?
  echo "--- 连接断开（退出码 $code），5 秒后重连 ---"
  sleep 5
done
