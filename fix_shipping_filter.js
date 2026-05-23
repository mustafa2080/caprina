
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "artifacts/api-server/src/routes/orders.ts");
let code = fs.readFileSync(filePath, "utf8");

// استخدم regex بدل exact string match
const OLD_REGEX = /const filteredGroups = Array\.from\(groupMap\.values\(\)\)\.filter\(grp => \{[\s\S]*?if \(manifestOrderIdsSet\.size === 0\) return true;[\s\S]*?const allInManifest = grp\.every\(o => manifestOrderIdsSet\.has\(o\.id\)\);[\s\S]*?return !allInManifest;[\s\S]*?\}\);/;

const NEW = `const filteredGroups = Array.from(groupMap.values()).filter(grp => {
    // \u0644\u0645\u0627 \u0627\u0644\u0641\u0644\u062a\u0631 = in_shipping \u2192 \u0646\u062c\u064a\u0628 \u0628\u0633 \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0644\u064a \u0641\u064a \u0628\u064a\u0627\u0646 \u0645\u0641\u062a\u0648\u062d \u0641\u0639\u0644\u0627\u064b
    if (params.data.status === "in_shipping" && manifestOrderIdsSet.size > 0) {
      return grp.some(o => manifestOrderIdsSet.has(o.id));
    }
    // \u0641\u064a \u0627\u0644\u062d\u0627\u0644\u0627\u062a \u0627\u0644\u062a\u0627\u0646\u064a\u0629 (\u0628\u062f\u0648\u0646 \u0641\u0644\u062a\u0631 status) \u2192 \u0646\u0634\u064a\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0644\u064a \u0643\u0644\u0647\u0627 \u0641\u064a \u0628\u064a\u0627\u0646 \u0645\u0641\u062a\u0648\u062d
    if (!params.data.status && manifestOrderIdsSet.size > 0) {
      const allInManifest = grp.every(o => manifestOrderIdsSet.has(o.id));
      return !allInManifest;
    }
    return true;
  });`;

if (OLD_REGEX.test(code)) {
  code = code.replace(OLD_REGEX, NEW);
  fs.writeFileSync(filePath, code, "utf8");
  console.log("SUCCESS - in_shipping filter fixed");
} else {
  console.log("REGEX NOT MATCHED - trying manual approach");
  // manual: replace line by line
  const lines = code.split("\n");
  const startIdx = lines.findIndex(l => l.includes("filteredGroups = Array.from(groupMap.values())"));
  if (startIdx === -1) { console.log("NOT FOUND at all"); process.exit(1); }
  // إيجاد نهاية الـ block
  let endIdx = startIdx;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim() === "});") {
      endIdx = i;
      break;
    }
  }
  console.log("Block from line", startIdx+1, "to", endIdx+1);
  console.log(lines.slice(startIdx, endIdx+1).join("\n"));
}
