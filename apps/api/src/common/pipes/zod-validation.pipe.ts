import { PipeTransform, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates a request body/param against a Zod schema. A failure is a semantic
 * validation error → HTTP 422, which the exception filter maps to the canonical
 * VALIDATION_FAILED error code (BUILD_GUIDE §12).
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}
