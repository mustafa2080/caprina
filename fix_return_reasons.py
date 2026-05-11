import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]

# 1. order-constants.ts
for root, dirs, files in os.walk(os.path.join(base, d)):
    dirs[:] = [dd for dd in dirs if dd not in ['node_modules', '.git', 'dist']]
    for f in files:
        if f == 'order-constants.ts':
            constants_path = os.path.join(root, f)

with open(constants_path, 'r', encoding='utf-8') as f:
    content = f.read()

# change customer_refused label + add customer_requested_return
old_refused = '{ value: "customer_refused", label: "\u0631\u0641\u0636 \u0627\u0644\u0639\u0645\u064a\u0644" },'
new_refused  = '{ value: "customer_refused", label: "\u0639\u0645\u064a\u0644 \u063a\u064a\u0631 \u062c\u0627\u062f" },\n  { value: "customer_requested_return", label: "\u0637\u0644\u0628 \u0627\u0644\u0639\u0645\u064a\u0644 \u0645\u0631\u062a\u062c\u0639" },'

if old_refused in content:
    content = content.replace(old_refused, new_refused, 1)
    print("✅ Updated RETURN_REASONS in constants")
else:
    print("❌ RETURN_REASONS not found in constants")
    idx = content.find('customer_refused')
    print(repr(content[idx-50:idx+100]))

with open(constants_path, 'w', encoding='utf-8') as f:
    f.write(content)

# 2. analytics.ts
for root, dirs, files in os.walk(os.path.join(base, d)):
    dirs[:] = [dd for dd in dirs if dd not in ['node_modules', '.git', 'dist']]
    for f in files:
        if f == 'analytics.ts' and 'api-server' in root:
            analytics_path = os.path.join(root, f)

with open(analytics_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_label = '    customer_refused: "\u0631\u0641\u0636 \u0627\u0644\u0639\u0645\u064a\u0644",'
new_label  = '    customer_refused: "\u0639\u0645\u064a\u0644 \u063a\u064a\u0631 \u062c\u0627\u062f",\n    customer_requested_return: "\u0637\u0644\u0628 \u0627\u0644\u0639\u0645\u064a\u0644 \u0645\u0631\u062a\u062c\u0639",'

if old_label in content:
    content = content.replace(old_label, new_label, 1)
    print("✅ Updated REASON_LABELS in analytics")
else:
    print("❌ REASON_LABELS not found in analytics")

with open(analytics_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
