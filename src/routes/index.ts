import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import bannersRouter from "./banners";
import outletsRouter from "./outlets";
import menuItemsRouter from "./menu-items";
import beveragesRouter from "./beverages";
import galleryRouter from "./gallery";
import siteInfoRouter from "./site-info";
import promotionsRouter from "./promotions";
import authRouter from "./auth";
import usersRouter from "./users";

import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Exclude public paths from non-GET protection
const PUBLIC_PATHS = ["/auth/login", "/health"];

router.use((req, res, next) => {
  // GET, HEAD, OPTIONS are always public
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  
  // Public non-GET paths
  if (PUBLIC_PATHS.includes(req.path)) {
    return next();
  }
  
  // All other write operations require authentication
  return requireAuth(req, res, next);
});

router.use(healthRouter);
router.use(storageRouter);
router.use(bannersRouter);
router.use(outletsRouter);
router.use(menuItemsRouter);
router.use(beveragesRouter);
router.use(galleryRouter);
router.use(siteInfoRouter);
router.use(promotionsRouter);
router.use(authRouter);
router.use(usersRouter);

export default router;

