from PIL import Image
import base64, io

img = Image.open(r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\public\first_logo.jpg')
w, h = img.size
print('original:', w, h)

# crop مربع من اليمين (اللوجو على اليمين)
square = img.crop((w - h, 0, w, h))
square = square.resize((300, 300), Image.LANCZOS)

buf = io.BytesIO()
square.save(buf, format='JPEG', quality=85)
b64 = base64.b64encode(buf.getvalue()).decode()

data = 'export const firstLogoBase64 = "data:image/jpeg;base64,' + b64 + '";\n'

out_path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\lib\first-logo.ts'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(data)

print('done! b64 length:', len(b64))
