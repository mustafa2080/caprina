import os, sys

p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'artifacts', 'caprina', 'src', 'components', 'layout.tsx')
with open(p, encoding='utf-8') as f:
    c = f.read()

c = c.replace('width: "38px",', 'width: "42px",', 1)
c = c.replace('height: "38px",', 'height: "42px",', 1)
c = c.replace('borderRadius: "11px",', 'borderRadius: "13px",', 1)
c = c.replace('width: isActive ? "19px" : "17px"', 'width: isActive ? "22px" : "20px"', 1)
c = c.replace('height: isActive ? "19px" : "17px"', 'height: isActive ? "22px" : "20px"', 1)
c = c.replace('fontSize: "12px", letterSpacing: "0.01em"', 'fontSize: "13.5px", letterSpacing: "0.01em"', 1)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)

print('Done!')
