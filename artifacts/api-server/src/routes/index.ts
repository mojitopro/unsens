import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import execRouter from "./exec";
import searchRouter from "./search";
import historyRouter from "./history";
import projectRouter from "./project";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(execRouter);
router.use(searchRouter);
router.use(historyRouter);
router.use(projectRouter);

export default router;
