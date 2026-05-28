from PIL import Image
import base64, io

img = Image.open(r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\public\first_logo.jpg')

# resize بنسبة ثابتة — ارتفاع 64px مع الحفاظ على النسبة
w, h = img.size
new_h = 64
new_w = int(w * new_h / h)
img = img.resize((new_w, new_h), Image.LANCZOS)

buf = io.BytesIO()
img.save(buf, format='JPEG', quality=90)
b64 = base64.b64encode(buf.getvalue()).decode()

data = 'export const firstLogoBase64 = "data:image/jpeg;base64,' + b64 + '";\n'

out_path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\lib\first-logo.ts'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(data)

print('done! size:', new_w, 'x', new_h, '| b64 length:', len(b64))
