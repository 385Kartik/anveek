const fs = require("fs");
const path = require("path");

const envConfig = {};
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const idx = trimmed.indexOf("=");
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          envConfig[key] = val;
        }
      }
    }
  }
} catch (e) {}

module.exports = {
  apps: [
    {
      name: "anveek-store",
      cwd: "/var/www/anveek",
      script: ".output/server/index.mjs",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3005,
        ADMIN_PASSWORD: "admin",
        ...envConfig,
      },
    },
  ],
};
