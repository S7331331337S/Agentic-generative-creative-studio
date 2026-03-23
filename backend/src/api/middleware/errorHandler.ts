import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@agcs/shared';
import { logger } from '../../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const response: ApiResponse = {
    success: false,
    error: err.message || 'Internal server error',
    timestamp: Date.now(),
  };

  res.status(500).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse = {
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    timestamp: Date.now(),
  };
  res.status(404).json(response);
}
