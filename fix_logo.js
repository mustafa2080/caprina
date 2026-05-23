const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\components\\layout.tsx');

let content = fs.readFileSync(filePath, 'utf8');

const oldSnippet = 'className="w-full flex items-center justify-center overflow-hidden"\n            style={{\n              background: "#0a0a0a",\n              borderBottom: "2px solid hsl(var(--primary)/0.5)",\n              boxShadow: "0 4px 24px hsl(var(--primary)/0.2)",\n              maxHeight: "130px",\n            }}\n          >\n            <img\n              src={firstLogoBase64}\n              alt="Caprina Logo"\n              style={{\n                width: "100%",\n                height: "auto",\n                display: "block",\n                maxHeight: "130px",\n                objectFit: "contain",\n                filter: "drop-shadow(0 0 12px hsl(var(--primary)/0.4))",\n              }}\n            />\n          </div>';

const newSnippet = 'className="w-full flex items-center justify-center"\n            style={{\n              background: "linear-gradient(180deg, #0d0d0d 0%, #111 100%)",\n              borderBottom: "1px solid hsl(var(--primary)/0.35)",\n              padding: "14px 20px",\n              position: "relative",\n            }}\n          >\n            <div style={{\n              position: "absolute",\n              inset: 0,\n              background: "radial-gradient(ellipse 80% 70% at 50% 50%, hsl(var(--primary)/0.12) 0%, transparent 70%)",\n              pointerEvents: "none",\n            }} />\n            <img\n              src={firstLogoBase64}\n              alt="Caprina Logo"\n              style={{\n                display: "block",\n                width: "auto",\n                height: "auto",\n                maxWidth: "160px",\n                maxHeight: "110px",\n                objectFit: "contain",\n                position: "relative",\n                zIndex: 1,\n                filter: "drop-shadow(0 0 16px hsl(var(--primary)/0.55)) drop-shadow(0 2px 8px rgba(0,0,0,0.8))",\n              }}\n            />\n          </div>';

if (content.includes('overflow-hidden')) {
  content = content.replace(oldSnippet, newSnippet);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESS: Logo block updated');
} else {
  console.log('ERROR: overflow-hidden not found in file');
  // show surrounding context
  const idx = content.indexOf('First Logo');
  console.log('Context around First Logo:', content.substring(idx, idx + 300));
}
