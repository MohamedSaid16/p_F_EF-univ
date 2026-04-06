import "dotenv/config"; // يجب أن يكون أول سطر
import { createServer } from "http";
import app from "./app";
import { connectDatabase } from "./config/database";
import { ensureRbacCatalog } from "./services/common/rbac.service";
import { ensureRequestWorkflowHistoryTable } from "./services/requests/workflow.service";
import { ensureAuditLogTable } from "./services/common/audit-log.service";
import { initializeRealtimeServer } from "./realtime/socket.server";

const PORT = process.env.PORT || 5000;

// تشغيل السيرفر
async function startServer() {
  try {
    // الاتصال بقاعدة البيانات أولاً
    await connectDatabase();

    // Ensure critical runtime tables/catalogs exist before serving traffic.
    await Promise.all([
      ensureRbacCatalog(),
      ensureRequestWorkflowHistoryTable(),
      ensureAuditLogTable(),
    ]);

    const httpServer = createServer(app);
    initializeRealtimeServer(httpServer);

    // ثم تشغيل السيرفر
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();