const fs = require('fs');

const filePath = "C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\components\\layout.tsx";

let content = fs.readFileSync(filePath, 'utf8');

const oldBlock = `          {/* \u2500\u2500 First Logo \u2500\u2500 */}\r\n          <div\r\n            className="w-full flex items-center justify-center overflow-hidden"\r\n            style={{\r\n              background: "#0a0a0a",\r\n              borderBottom: "2px solid hsl(var(--primary)/0.5)",\r\n              boxShadow: "0 4px 24px hsl(var(--primary)/0.2)",\r\n              maxHeight: "130px",\r\n            }}\r\n          >\r\n            <img\r\n              src={firstLogoBase64}\r\n              alt="Caprina Logo"\r\n              style={{\r\n                width: "100%",\r\n                height: "auto",\r\n                display: "block",\r\n                maxHeight: "130px",\r\n                objectFit: "contain",\r\n                filter: "drop-shadow(0 0 12px hsl(var(--primary)/0.4))",\r\n              }}\r\n            />\r\n          </div>`;

const newBlock = `          {/* \u2500\u2500 First Logo \u2500\u2500 */}\r\n          <div\r\n            className="w-full flex items-center justify-center"\r\n            style={{\r\n              background: "linear-gradient(180deg, #0a0a0a 0%, #141414 100%)",\r\n              padding: "16px 12px",\r\n              position: "relative",\r\n              borderBottom: "1px solid hsl(var(--primary)/0.3)",\r\n            }}\r\n          >\r\n            {/* Ambient glow */}\r\n            <div style={{\r\n              position: "absolute",\r\n              inset: 0,\r\n              background: "radial-gradient(ellipse 90% 80% at 50% 50%, hsl(var(--primary)/0.08) 0%, transparent 65%)",\r\n              pointerEvents: "none",\r\n            }} />\r\n            {/* Bottom accent line */}\r\n            <div style={{\r\n              position: "absolute",\r\n              bottom: 0,\r\n              left: "15%",\r\n              right: "15%",\r\n              height: "1px",\r\n              background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.6), transparent)",\r\n              pointerEvents: "none",\r\n            }} />\r\n            <img\r\n              src={firstLogoBase64}\r\n              alt="Caprina Logo"\r\n              style={{\r\n                display: "block",\r\n                width: "auto",\r\n                height: "auto",\r\n                maxWidth: "140px",\r\n                maxHeight: "100px",\r\n                objectFit: "contain",\r\n                position: "relative",\r\n                zIndex: 1,\r\n                filter: "drop-shadow(0 0 14px hsl(var(--primary)/0.6)) drop-shadow(0 0 4px hsl(var(--primary)/0.3))",\r\n              }}\r\n            />\r\n          </div>`;

if (content.includes(oldBlock)) {
  const newContent = content.replace(oldBlock, newBlock);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('SUCCESS');
} else {
  console.log('NOT FOUND - trying partial match');
  console.log('Has overflow-hidden:', content.includes('overflow-hidden'));
  console.log('Has First Logo:', content.includes('First Logo'));
}
