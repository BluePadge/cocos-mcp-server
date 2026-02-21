#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH=""
COCOS_APP="/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
HEALTH_URL="http://127.0.0.1:3000/health"
MCP_URL="http://127.0.0.1:3000/mcp"
WAIT_SECONDS=120
VERIFY_MCP=1
LOG_PATH="/tmp/cocos-project-restart.log"

usage() {
  cat <<'USAGE'
用法:
  scripts/restart-cocos-project.sh --project <project_path> [选项]

选项:
  --project <path>       必填，Cocos 工程路径
  --app <path>           CocosCreator 可执行文件路径
  --health-url <url>     health 接口地址，默认 http://127.0.0.1:3000/health
  --mcp-url <url>        MCP 接口地址，默认 http://127.0.0.1:3000/mcp
  --wait-seconds <sec>   最长等待秒数，默认 120
  --log-path <path>      启动日志输出路径，默认 /tmp/cocos-project-restart.log
  --no-verify-mcp        仅检查 health 就绪，不做 MCP 握手校验
  -h, --help             查看帮助
USAGE
}

if [[ $# -eq 0 ]]; then
  usage
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_PATH="${2:-}"
      shift 2
      ;;
    --app)
      COCOS_APP="${2:-}"
      shift 2
      ;;
    --health-url)
      HEALTH_URL="${2:-}"
      shift 2
      ;;
    --mcp-url)
      MCP_URL="${2:-}"
      shift 2
      ;;
    --wait-seconds)
      WAIT_SECONDS="${2:-}"
      shift 2
      ;;
    --log-path)
      LOG_PATH="${2:-}"
      shift 2
      ;;
    --no-verify-mcp)
      VERIFY_MCP=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[restart-cocos] 未知参数: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT_PATH" ]]; then
  echo "[restart-cocos] 缺少 --project 参数" >&2
  usage
  exit 1
fi

if [[ ! -x "$COCOS_APP" ]]; then
  echo "[restart-cocos] Cocos 可执行文件不存在或不可执行: $COCOS_APP" >&2
  exit 1
fi

if [[ ! -d "$PROJECT_PATH" ]]; then
  echo "[restart-cocos] 工程路径不存在: $PROJECT_PATH" >&2
  exit 1
fi

if ! [[ "$WAIT_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "[restart-cocos] --wait-seconds 必须是正整数" >&2
  exit 1
fi

# 为了保证切换到目标工程，先关闭全部 Cocos 主进程（避免被已有实例接管打开请求）
all_instances_pattern="CocosCreator.app/Contents/MacOS/CocosCreator --project "
target_pattern="CocosCreator.*--project ${PROJECT_PATH}"

if pgrep -f "$all_instances_pattern" >/dev/null; then
  echo "[restart-cocos] 检测到已有 Cocos 实例，准备全部关闭..."
  pkill -TERM -f "$all_instances_pattern" || true
  for _ in $(seq 1 40); do
    if ! pgrep -f "$all_instances_pattern" >/dev/null; then
      break
    fi
    sleep 0.5
  done
  if pgrep -f "$all_instances_pattern" >/dev/null; then
    echo "[restart-cocos] TERM 未完全退出，执行 KILL"
    pkill -KILL -f "$all_instances_pattern" || true
  fi
fi

echo "[restart-cocos] 启动工程: $PROJECT_PATH"
app_bundle=""
if [[ "$COCOS_APP" == *".app/Contents/MacOS/"* ]]; then
  app_bundle="${COCOS_APP%%/Contents/MacOS/*}.app"
fi

if [[ -n "$app_bundle" && -d "$app_bundle" ]]; then
  nohup open -na "$app_bundle" --args --project "$PROJECT_PATH" --can-show-upgrade-dialog true >"$LOG_PATH" 2>&1 < /dev/null &
else
  nohup "$COCOS_APP" --project "$PROJECT_PATH" --can-show-upgrade-dialog true >"$LOG_PATH" 2>&1 < /dev/null &
fi
COCOS_PID=$!
disown "$COCOS_PID" 2>/dev/null || true

check_health_ready() {
  local health_json="$1"
  node -e '
const raw = process.argv[1];
try {
  const data = JSON.parse(raw);
  const ok = data && data.status === "ok" && Number(data.tools) > 0;
  process.exit(ok ? 0 : 1);
} catch {
  process.exit(1);
}
' "$health_json"
}

verify_mcp_ready() {
  local init_headers
  init_headers=$(mktemp)
  local init_body
  init_body=$(mktemp)

  local init_payload
  init_payload='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"restart-cocos-script","version":"1.0.0"}}}'

  if ! curl -sS -D "$init_headers" -o "$init_body" -H 'Content-Type: application/json' -X POST "$MCP_URL" --data "$init_payload" >/dev/null; then
    rm -f "$init_headers" "$init_body"
    return 1
  fi

  local session_id
  session_id=$(awk -F': ' 'tolower($1)=="mcp-session-id" {print $2}' "$init_headers" | tr -d '\r')
  if [[ -z "$session_id" ]]; then
    rm -f "$init_headers" "$init_body"
    return 1
  fi

  curl -sS -H 'Content-Type: application/json' -H "MCP-Session-Id: $session_id" -X POST "$MCP_URL" --data '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true

  local tools_json
  tools_json=$(curl -sS -H 'Content-Type: application/json' -H "MCP-Session-Id: $session_id" -X POST "$MCP_URL" --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' || true)

  curl -sS -X DELETE -H "MCP-Session-Id: $session_id" "$MCP_URL" >/dev/null || true
  rm -f "$init_headers" "$init_body"

  node -e '
const raw = process.argv[1];
try {
  const payload = JSON.parse(raw);
  const tools = payload?.result?.tools;
  process.exit(Array.isArray(tools) && tools.length > 0 ? 0 : 1);
} catch {
  process.exit(1);
}
' "$tools_json"
}

ready=0
consecutive_ready=0
for _ in $(seq 1 "$WAIT_SECONDS"); do
  # 必须先确认目标工程实例已经拉起，避免误判其他工程实例的 health
  if ! pgrep -f "$target_pattern" >/dev/null; then
    consecutive_ready=0
    sleep 1
    continue
  fi

  health_json=$(curl -sS "$HEALTH_URL" 2>/dev/null || true)
  if [[ -n "$health_json" ]] && check_health_ready "$health_json"; then
    if [[ "$VERIFY_MCP" -eq 1 ]]; then
      if verify_mcp_ready; then
        consecutive_ready=$((consecutive_ready + 1))
      else
        consecutive_ready=0
      fi
    else
      consecutive_ready=$((consecutive_ready + 1))
    fi
  else
    consecutive_ready=0
  fi

  if [[ "$consecutive_ready" -ge 2 ]]; then
    if [[ "$VERIFY_MCP" -eq 1 ]]; then
      echo "[restart-cocos] 就绪成功（health + MCP 握手，连续2次）: $health_json"
    else
      echo "[restart-cocos] 就绪成功（health，连续2次）: $health_json"
    fi
    ready=1
    break
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo "[restart-cocos] 启动超时，未完成就绪。请检查日志: $LOG_PATH" >&2
  exit 1
fi

echo "[restart-cocos] 完成"
