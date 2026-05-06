import json
with open('C:/Users/musta/AppData/Local/Temp/manifest122.json') as f:
    d = json.load(f)
orders = d.get('orders', [])
print('total orders:', len(orders))
for o in orders:
    print("id=%d qty=%d partial=%s status=%s invoice=%s" % (o['id'], o['quantity'], o.get('partialQuantity'), o['deliveryStatus'], o.get('invoiceNumber')))
