import pathlib

f = pathlib.Path('C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/charts-section.tsx')

# Read as bytes, detect encoding
raw = f.read_bytes()
# Try utf-8 first
try:
    content = raw.decode('utf-8')
    print('Encoding: utf-8')
except:
    content = raw.decode('utf-8-sig')
    print('Encoding: utf-8-sig')

# Check what's currently there
idx = content.find('Day name short')
print(repr(content[idx:idx+200]))
