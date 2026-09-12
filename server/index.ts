import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "0.0.0.0";
const app = createApp();

app.listen(port, host, () => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: "service_started", service: "jiahui", host, port }));
});
