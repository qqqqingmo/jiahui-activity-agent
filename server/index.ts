import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3001);
const app = createApp();

app.listen(port, "127.0.0.1", () => {
  console.log(`嘉会服务已启动：http://127.0.0.1:${port}`);
});
