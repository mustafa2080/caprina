const fs = require('fs');

const filePath = "C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\components\\layout.tsx";

let content = fs.readFileSync(filePath, 'utf8');

// Replace the entire logo container block
const oldBlock = `          {/* \u2500\u2500 First Logo \u2500\u2500 */}\r\n          <div\r\n            className="w-full flex items-center justify-center"\r\n            style={{\r\n              background: "linear-gradient(180deg, #0a0a0a 0%, #141414 100%)",\r\n              padding: "16px 12px",\r\n              position: "relative",\r\n              borderBottom: "1px solid hsl(var(--primary)/0.3)",\r\n            }}\r\n          >\r\n            {/* Ambient glow */}\r\n            <div style={{\r\n              position: "absolute",\r\n              inset: 0,\r\n              background: "radial-gradient(ellipse 90% 80% at 50% 50%, hsl(var(--primary)/0.08) 0%, transparent 65%)",\r\n              pointerEvents: "none",\r\n            }} />\r\n            {/* Bottom accent line */}\r\n            <div style={{\r\n              position: "absolute",\r\n              bottom: 0,\r\n              left: "15%",\r\n              right: "15%",\r\n              height: "1px",\r\n              background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.6), transparent)",\r\n              pointerEvents: "none",\r\n            }} />\r\n            <img\r\n              src={firstLogoBase64}\r\n              alt="Caprina Logo"\r\n              style={{\r\n                display: "block",\r\n                width: "auto",\r\n                height: "auto",\r\n                maxWidth: "140px",\r\n                maxHeight: "100px",\r\n                objectFit: "contain",\r\n                position: "relative",\r\n                zIndex: 1,\r\n                filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.6)) drop-shadow(0 0 4px hsl(var(--primary)/0.3))",\r\n              }}\r\n            />\r\n          </div>`;

const newBlock = `          {/* \u2500\u2500 First Logo \u2500\u2500 */}\r\n          <div\r\n            style={{\r\n              position: "relative",\r\n              width: "100%",\r\n              background: "linear-gradient(180deg, #0a0a0a 0%, #111 100%)",\r\n              borderBottom: "1px solid hsl(var(--primary)/0.4)",\r\n              display: "flex",\r\n              alignItems: "center",\r\n              justifyContent: "center",\r\n              padding: "10px 8px",\r\n            }}\r\n          >\r\n            {/* glow bg */}\r\n            <div style={{\r\n              position: "absolute", inset: 0, pointerEvents: "none",\r\n              background: "radial-gradient(ellipse 100% 100% at 50% 50%, hsl(var(--primary)/0.1) 0%, transparent 70%)",\r\n            }} />\r\n            {/* bottom line */}\r\n            <div style={{\r\n              position: "absolute", bottom: 0, left: "10%", right: "10%",\r\n              height: "1px", pointerEvents: "none",\r\n              background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.7), transparent)",\r\n            }} />\r\n            <img\r\n              src={firstLogoBase64}\r\n              alt="Caprina Logo"\r\n              style={{\r\n                display: "block",\r\n                width: "85%",\r\n                height: "auto",\r\n                maxHeight: "120px",\r\n                objectFit: "contain",\r\n                position: "relative",\r\n                zIndex: 1,\r\n                filter: "drop-shadow(0 0 18px hsl(var(--primary)/0.7)) drop-shadow(0 2px 6px rgba(0,0,0,0.9))",\r\n              }}\r\n            />\r\n          </div>`;

if (content.includes('maxWidth: "140px"')) {
  const newContent = content.replace(oldBlock, newBlock);
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('SUCCESS');
  } else {
    console.log('REPLACE FAILED - block mismatch');
  }
} else {
  console.log('ERROR: marker not found');
}
