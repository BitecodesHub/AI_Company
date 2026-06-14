import { All, Controller, Req, Res, SetMetadata } from '@nestjs/common';
import { serve } from 'inngest/express';
import type { Request, Response } from 'express';
import {
  inngest,
  agentRunFunction,
  kbIngestFunction,
  controllerDispatchFunction,
  contentGenerateFunction,
  schedulerTickFunction,
  memoryConsolidateFunction,
} from '../inngest/index.js';

const INNGEST_FUNCTIONS = [
  agentRunFunction,
  kbIngestFunction,
  controllerDispatchFunction,
  contentGenerateFunction,
  schedulerTickFunction,
  memoryConsolidateFunction,
];

@Controller('api/inngest')
export class InngestController {
  private readonly handler = serve({
    client: inngest,
    functions: INNGEST_FUNCTIONS,
  });

  @All('*')
  @SetMetadata('isPublic', true)
  async handle(@Req() req: Request, @Res() res: Response) {
    return this.handler(req, res);
  }
}
