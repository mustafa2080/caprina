const { execSync } = require("child_process");
const dir = "C:\\Users\\musta\\Desktop\\pro\\CAPRIN~1\\Caprina-Orders";
try {
  execSync("git commit -m fix-filter-toggle && git push", { cwd: dir, stdio: "inherit", shell: "cmd" });
  console.log("DONE");
} catch(e) { console.error(e.message); }
