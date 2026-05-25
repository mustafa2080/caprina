#!/bin/bash
# ============================================================
#  test_users_api.sh — اختبار كامل لـ users API
#  الاستخدام: bash test_users_api.sh
# ============================================================

API="http://localhost:3000/api"   # غيّر البورت لو مختلف
ADMIN_USER="admin"
ADMIN_PASS="XXfahdXX4#"   # ← حط كلمة السر هنا

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} — $1"; }
fail() { echo -e "${RED}❌ FAIL${NC} — $1"; }
info() { echo -e "${YELLOW}▶ $1${NC}"; }

# ============================================================
# 1. LOGIN → احصل على التوكن
# ============================================================
info "1. تسجيل الدخول..."
LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")

TOKEN=$(echo $LOGIN | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  fail "فشل تسجيل الدخول — تأكد من كلمة السر"
  echo "Response: $LOGIN"
  exit 1
fi
pass "تسجيل الدخول — Token: ${TOKEN:0:30}..."

AUTH="-H \"Authorization: Bearer $TOKEN\""

# ============================================================
# 2. GET /users — جلب كل المستخدمين
# ============================================================
info "\n2. جلب كل المستخدمين (GET /users)..."
USERS=$(curl -s -X GET "$API/users" \
  -H "Authorization: Bearer $TOKEN")

USER_COUNT=$(echo $USERS | grep -o '"id"' | wc -l)
if [ "$USER_COUNT" -gt 0 ]; then
  pass "جلب المستخدمين — عدد المستخدمين: $USER_COUNT"
  echo "$USERS" | python3 -c "
import json,sys
users = json.load(sys.stdin)
for u in users:
    print(f\"  ID:{u['id']} | {u['username']} | {u['role']} | active:{u['isActive']}\")
" 2>/dev/null || echo "$USERS" | head -c 500
else
  fail "جلب المستخدمين — لا يوجد مستخدمون أو خطأ"
  echo "Response: $USERS"
fi

# ============================================================
# 3. POST /users — إضافة مستخدم جديد (test)
# ============================================================
info "\n3. إضافة مستخدم جديد (POST /users)..."
CREATE=$(curl -s -X POST "$API/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_curl",
    "password": "test1234",
    "displayName": "Test User cURL",
    "role": "employee",
    "permissions": []
  }')

NEW_ID=$(echo $CREATE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
if [ -n "$NEW_ID" ]; then
  pass "إضافة مستخدم — ID الجديد: $NEW_ID"
else
  # ممكن موجود مسبقاً
  ERR=$(echo $CREATE | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
  if [ "$ERR" = "اسم المستخدم موجود مسبقاً" ]; then
    info "المستخدم موجود مسبقاً — هنجيب الـ ID منه"
    NEW_ID=$(echo $USERS | python3 -c "
import json,sys
users = json.load(sys.stdin)
u = next((u for u in users if u['username']=='testuser_curl'), None)
print(u['id'] if u else '')
" 2>/dev/null)
    pass "استخدام المستخدم الموجود — ID: $NEW_ID"
  else
    fail "إضافة مستخدم — $ERR"
    echo "Response: $CREATE"
  fi
fi

# ============================================================
# 4. POST /users — بيانات ناقصة (يجب يرجع 400)
# ============================================================
info "\n4. إضافة مستخدم ببيانات ناقصة (يجب يرجع خطأ 400)..."
BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "nopass"}')

if [ "$BAD" = "400" ]; then
  pass "رفض البيانات الناقصة — HTTP $BAD"
else
  fail "لم يرفض البيانات الناقصة — HTTP $BAD"
fi

# ============================================================
# 5. POST /users — كلمة سر قصيرة (يجب يرجع 400)
# ============================================================
info "\n5. كلمة سر أقل من 6 أحرف (يجب يرجع 400)..."
SHORT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"shortpass","password":"123","displayName":"Test","role":"employee"}')

if [ "$SHORT" = "400" ]; then
  pass "رفض كلمة السر القصيرة — HTTP $SHORT"
else
  fail "لم يرفض كلمة السر القصيرة — HTTP $SHORT"
fi

# ============================================================
# 6. PATCH /users/:id — تعديل المستخدم
# ============================================================
if [ -n "$NEW_ID" ]; then
  info "\n6. تعديل المستخدم (PATCH /users/$NEW_ID)..."
  PATCH=$(curl -s -X PATCH "$API/users/$NEW_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"displayName": "Test User Updated", "role": "warehouse"}')

  UPDATED_NAME=$(echo $PATCH | grep -o '"displayName":"[^"]*"' | cut -d'"' -f4)
  if [ "$UPDATED_NAME" = "Test User Updated" ]; then
    pass "تعديل المستخدم — الاسم الجديد: $UPDATED_NAME"
  else
    fail "تعديل المستخدم"
    echo "Response: $PATCH"
  fi

  # ============================================================
  # 7. PATCH — تعطيل الحساب (isActive = false)
  # ============================================================
  info "\n7. تعطيل الحساب (isActive = false)..."
  DEACT=$(curl -s -X PATCH "$API/users/$NEW_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"isActive": false}')

  IS_ACTIVE=$(echo $DEACT | grep -o '"isActive":[a-z]*' | cut -d':' -f2)
  if [ "$IS_ACTIVE" = "false" ]; then
    pass "تعطيل الحساب"
  else
    fail "تعطيل الحساب"
    echo "Response: $DEACT"
  fi

  # ============================================================
  # 8. PATCH — إعادة تفعيل الحساب
  # ============================================================
  info "\n8. إعادة تفعيل الحساب (isActive = true)..."
  REACT=$(curl -s -X PATCH "$API/users/$NEW_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"isActive": true}')

  IS_ACTIVE2=$(echo $REACT | grep -o '"isActive":[a-z]*' | cut -d':' -f2)
  if [ "$IS_ACTIVE2" = "true" ]; then
    pass "إعادة تفعيل الحساب"
  else
    fail "إعادة تفعيل الحساب"
    echo "Response: $REACT"
  fi

  # ============================================================
  # 9. DELETE /users/:id — حذف المستخدم
  # ============================================================
  info "\n9. حذف المستخدم (DELETE /users/$NEW_ID)..."
  DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/users/$NEW_ID" \
    -H "Authorization: Bearer $TOKEN")

  if [ "$DEL" = "204" ]; then
    pass "حذف المستخدم — HTTP $DEL"
  else
    fail "حذف المستخدم — HTTP $DEL"
  fi
fi

# ============================================================
# 10. DELETE — حذف نفسك (يجب يرجع 400)
# ============================================================
info "\n10. حذف نفسك (يجب يرجع 400)..."
MY_ID=$(echo $LOGIN | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
SELF=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/users/$MY_ID" \
  -H "Authorization: Bearer $TOKEN")

if [ "$SELF" = "400" ]; then
  pass "رفض حذف نفسك — HTTP $SELF"
else
  fail "لم يرفض حذف نفسك — HTTP $SELF"
fi

# ============================================================
# 11. بدون توكن (يجب يرجع 401)
# ============================================================
info "\n11. طلب بدون توكن (يجب يرجع 401)..."
UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API/users")

if [ "$UNAUTH" = "401" ]; then
  pass "رفض الطلب بدون توكن — HTTP $UNAUTH"
else
  fail "لم يرفض الطلب بدون توكن — HTTP $UNAUTH"
fi

# ============================================================
echo -e "\n${YELLOW}=============================="
echo -e "  اكتمل الاختبار ✅"
echo -e "==============================${NC}"