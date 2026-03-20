import { createServer } from "./index";

const app = createServer();
const port = 3000;

app.listen(port, () => {
    console.log(`🚀 API server running on port ${port}`);
    console.log(`🔧 API: http://localhost:${port}/api`);
});
