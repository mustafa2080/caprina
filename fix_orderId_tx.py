path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\order-detail.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the JSON body of the transaction call and add orderId
# We know the line is:  transactionDate: new Date().toISOString(),
old = '          transactionDate: new Date().toISOString(),\n        }),'
new = '          transactionDate: new Date().toISOString(),\n          orderId: order.id,\n        }),'

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done - orderId added to transaction body')
else:
    print('ERROR: pattern not found')
    idx = content.find('transactionDate: new Date().toISOString()')
    print(repr(content[idx:idx+150]))
