#!/usr/bin/env bash
# ============================================================
# PocketBase 集合初始化脚本
# 通过 API 直接创建 careerhub 需要的 12 张数据表
# 用法：bash pb-init.sh   （在服务器上跑，会提示输入管理员账号密码）
# ============================================================
set -e

PB="${PB_URL:-http://127.0.0.1:8090}"

read -rp "PocketBase 管理员邮箱: " EMAIL
read -rsp "PocketBase 管理员密码: " PASS
echo

# 1. 认证拿 token
TOKEN=$(curl -s -X POST "$PB/api/admins/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 认证失败，请检查邮箱密码"; exit 1
fi
echo "✓ 认证成功"

# 2. 逐个创建集合
COLLECTIONS="applications interviews jobs companies resumes skills leetcode journal events speeches opportunities settings"
RULE='owner = @request.auth.id'

for name in $COLLECTIONS; do
  CODE=$(curl -s -X POST "$PB/api/collections" \
    -H "Authorization: $TOKEN" \
    -H 'Content-Type: application/json' \
    -o /dev/null -w "%{http_code}" \
    -d "{
      \"name\": \"$name\",
      \"type\": \"base\",
      \"schema\": [
        { \"name\": \"owner\", \"type\": \"text\", \"required\": true },
        { \"name\": \"payload\", \"type\": \"json\", \"required\": false, \"options\": { \"maxSize\": 5242880 } }
      ],
      \"listRule\": \"$RULE\",
      \"viewRule\": \"$RULE\",
      \"createRule\": \"$RULE\",
      \"updateRule\": \"$RULE\",
      \"deleteRule\": \"$RULE\"
    }")
  if [ "$CODE" = "200" ]; then
    echo "  ✓ $name 创建成功"
  elif [ "$CODE" = "400" ]; then
    echo "  • $name 已存在（跳过）"
  else
    echo "  ❌ $name 创建失败 (HTTP $CODE)"
  fi
done

echo "完成！去 http://你的IP:9528/_/ 后台确认集合列表。"
