// routes/dashboard.js
import { getDashboardStats } from '../queries/dashboard.js';
import { authorize } from '../middleware/authorize.js';

export default async function dashboardRoutes(app) {
  app.get('/', { preHandler: authorize('read') },
    async (req) => getDashboardStats(req.db)
  );
}
