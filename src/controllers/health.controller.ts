import { Request, Response } from "express";
import logger from "../configs/logger.config";

export default class HealthController {
  public checkHealth = (req: Request, res: Response): void => {
    (async () => {
      logger.info("Auth microservice is alive");
      res.status(200).json({ message: "Auth microservice is alive" });
    })();
  };
}
