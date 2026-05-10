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

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(bannersRouter);
router.use(outletsRouter);
router.use(menuItemsRouter);
router.use(beveragesRouter);
router.use(galleryRouter);
router.use(siteInfoRouter);
router.use(promotionsRouter);

export default router;

